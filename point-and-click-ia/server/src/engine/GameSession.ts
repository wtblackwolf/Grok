/**
 * GameSession : orchestre un tour de jeu.
 *
 *   action -> MJ (resolveAction) -> applyPatch -> événements -> perception (mémoires)
 *          -> inpainting de la région -> ré-analyse de la région -> réactions des personnages
 *
 * Le moteur ne connaît que les PORTS (providers/ports.ts) : brancher une vraie IA ne change rien ici.
 */
import {
  EventBus,
  MAX_ACTIONS,
  applyPatch,
  clamp,
  createIdGenerator,
  mergeRegionElements,
  toPixelRect,
  withArticle,
} from '@pnc/shared';
import type {
  ActResponse,
  BBox,
  Character,
  DialogueLine,
  Exit,
  GameAction,
  GameView,
  ImageEditRequest,
  ImagePatch,
  Location,
  SceneElement,
  TalkResponse,
  TravelResponse,
  WorldEvent,
  WorldState,
} from '@pnc/shared';
import type { CharacterPerspective, LocationDraft, Providers, WorldEventDraft } from '../providers/ports';
import { HttpError } from './errors';
import type { SessionEvents } from './events';
import { PerceptionSystem } from './perceptionSystem';
import { toGameView } from './views';

export const SCENE_WIDTH = 1280;
export const SCENE_HEIGHT = 720;
const PLAYER = 'le voyageur';

export class GameSession {
  readonly bus = new EventBus<SessionEvents>();
  world: WorldState = {
    turn: 0,
    player: { name: PLAYER, locationId: '' },
    locations: {},
    characters: {},
    inventory: [],
    history: [],
  };
  private nextId = createIdGenerator();
  private actionCache = new Map<string, GameAction>();
  private pending: SessionEvents['memory:added'][] = [];
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    readonly id: string,
    private providers: Providers,
  ) {
    new PerceptionSystem(this.bus, () => this.world);
    this.bus.on('memory:added', (p) => this.pending.push(p));
  }

  /** Sérialise les opérations d'une session (évite les courses si le joueur tape vite). */
  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  view(): GameView {
    return toGameView(this.id, this.world);
  }

  get currentLocation(): Location {
    return this.world.locations[this.world.player.locationId];
  }

  // -------------------------------------------------------------------------
  // Création
  // -------------------------------------------------------------------------

  init(): Promise<{ view: GameView; narration: string }> {
    return this.run(async () => {
      const draft = await this.providers.locations.initial();
      const loc = await this.buildLocation(draft);
      this.world.player.locationId = loc.id;
      this.recordEvents(
        [{ actorId: 'player', kind: 'arrival', description: 'Un voyageur entre, la cape trempée de brume.', perception: 'visible', salience: 2 }],
        loc.id,
      );
      this.pending = [];
      this.bus.emit('location:entered', { locationId: loc.id, generated: true });
      return { view: this.view(), narration: loc.description };
    });
  }

  /** Génère image + éléments + sorties + personnages d'un lieu à partir d'un brouillon. */
  private async buildLocation(draft: LocationDraft, from?: { location: Location; exit: Exit }): Promise<Location> {
    const id = this.nextId('loc');
    const image = await this.providers.image.generateScene({
      prompt: draft.scenePrompt,
      spec: draft.spec,
      width: SCENE_WIDTH,
      height: SCENE_HEIGHT,
    });
    const detected = await this.providers.vision.segment(image);
    const elements: SceneElement[] = detected.map((d) => ({ ...d, id: this.nextId('el'), state: { ...(d.state ?? {}) } }));
    const matches = (e: SceneElement, hint?: string) =>
      !!hint && (e.sourceRef === hint || e.name.toLowerCase().includes(hint.toLowerCase()));

    const exits: Exit[] = [];
    for (const e of elements.filter((el) => el.tags.includes('sortie'))) {
      const exit: Exit = { id: this.nextId('exit'), elementId: e.id, label: e.name };
      e.exitId = exit.id;
      exits.push(exit);
    }
    if (from) {
      // Le chemin du retour : l'élément désigné par le générateur, sinon la première sortie.
      const back = exits.find((x) => matches(elements.find((e) => e.id === x.elementId)!, draft.backExitHint)) ?? exits[0];
      if (back) back.targetLocationId = from.location.id;
    }

    for (const cd of draft.characters) {
      const el = elements.find((e) => matches(e, cd.elementHint));
      const character: Character = {
        id: this.nextId('char'),
        name: cd.name,
        background: cd.background,
        personality: cd.personality,
        mood: cd.mood,
        locationId: id,
        elementId: el?.id,
        memory: [],
      };
      if (el) el.characterId = character.id;
      this.world.characters[character.id] = character;
    }

    const loc: Location = {
      id,
      name: draft.name,
      description: draft.description,
      image,
      imageVersion: 1,
      elements,
      exits,
      createdAtTurn: this.world.turn,
    };
    this.world.locations[id] = loc;
    return loc;
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  private requireElement(elementId: string): { location: Location; element: SceneElement } {
    const location = this.currentLocation;
    const element = location.elements.find((e) => e.id === elementId);
    if (!element) throw new HttpError(404, `Élément introuvable dans ce lieu : ${elementId}`);
    return { location, element };
  }

  getActions(elementId: string): Promise<GameAction[]> {
    return this.run(async () => {
      const { location, element } = this.requireElement(elementId);
      const drafts = await this.providers.gameMaster.describeActions({ element, location, world: this.world });
      const actions = drafts.slice(0, MAX_ACTIONS).map((d) => ({ ...d, elementId }));
      for (const a of actions) this.actionCache.set(`${elementId}|${a.id}`, a);
      return actions;
    });
  }

  act(elementId: string, actionId: string): Promise<ActResponse> {
    return this.run(async () => {
      const action = this.actionCache.get(`${elementId}|${actionId}`);
      if (!action) throw new HttpError(400, 'Action inconnue ou périmée : redemandez les actions de cet élément.');
      const { location, element } = this.requireElement(elementId);

      if (action.type === 'talk') {
        return { view: this.view(), reactions: [], travelled: false, openDialogueWith: element.characterId };
      }
      if (action.type === 'travel' && element.exitId) {
        const t = await this.doTravel(element.exitId);
        return { view: t.view, narration: t.narration, reactions: t.reactions, travelled: true };
      }

      this.pending = [];
      const res = await this.providers.gameMaster.resolveAction(action, { element, location, world: this.world });
      this.world.turn++;
      const { world, applied, warnings } = applyPatch(this.world, res.patch);
      this.world = world;
      this.bus.emit('patch:applied', { applied, warnings });
      this.recordEvents(res.events, location.id);
      this.actionCache.clear(); // l'état a pu changer : les actions doivent être régénérées

      const imagePatch = res.imageEdit ? await this.editImage(res.imageEdit) : undefined;

      if (res.travelExitId) {
        const t = await this.doTravel(res.travelExitId);
        return { view: t.view, narration: [res.narration, t.narration].filter(Boolean).join(' '), reactions: t.reactions, travelled: true };
      }
      const reactions = await this.collectReactions();
      return { view: this.view(), narration: res.narration, imagePatch, reactions, travelled: false };
    });
  }

  /** Inpainting limité à la région, puis ré-analyse de cette seule région. */
  private async editImage(req: ImageEditRequest): Promise<ImagePatch> {
    const loc = this.world.locations[req.locationId];
    if (!loc) throw new HttpError(400, `Lieu introuvable pour la retouche : ${req.locationId}`);
    const region = clampRegion(req.region);
    const out = await this.providers.image.inpaint({ ...req, region, image: loc.image });
    const detected = await this.providers.vision.segment(out.image, region);
    loc.elements = mergeRegionElements(loc.elements, detected, region, () => this.nextId('el'));
    this.reconcileLinks(loc);
    loc.image = out.image;
    loc.imageVersion++;
    const patch: ImagePatch = {
      locationId: loc.id,
      region,
      pixelRect: toPixelRect(region, loc.image.width, loc.image.height),
      image: out.patch,
      fullImage: out.image,
      version: loc.imageVersion,
    };
    this.bus.emit('image:patched', patch);
    return patch;
  }

  /** Après une ré-analyse : sorties et personnages ne doivent pas pointer vers des éléments disparus. */
  private reconcileLinks(loc: Location): void {
    const ids = new Set(loc.elements.map((e) => e.id));
    loc.exits = loc.exits.filter((x) => ids.has(x.elementId));
    for (const c of Object.values(this.world.characters)) {
      if (c.locationId === loc.id && c.elementId && !ids.has(c.elementId)) c.elementId = undefined;
    }
  }

  // -------------------------------------------------------------------------
  // Dialogue
  // -------------------------------------------------------------------------

  talk(characterId: string, text: string): Promise<TalkResponse> {
    return this.run(async () => {
      const c = this.world.characters[characterId];
      if (!c) throw new HttpError(404, `Personnage introuvable : ${characterId}`);
      if (c.locationId !== this.world.player.locationId) throw new HttpError(400, `${c.name} n'est pas ici.`);
      const clean = text.trim().slice(0, 500);
      if (!clean) throw new HttpError(400, 'Message vide.');

      this.world.turn++;
      this.recordEvents(
        [{ actorId: 'player', kind: 'speech', description: `Le voyageur dit à ${c.name} : « ${clean} »`, perception: 'audible', salience: 2, targetCharacterId: c.id }],
        c.locationId,
      );
      this.pending = [];
      const r = await this.providers.dialogue.reply(this.perspective(c), clean);
      if (r.mood) c.mood = r.mood;
      this.recordEvents(
        [{ actorId: c.id, kind: 'speech', description: `${c.name} dit : « ${r.text} »`, perception: 'audible', salience: 1 }],
        c.locationId,
      );
      this.pending = [];
      return { lines: [{ speakerId: c.id, speakerName: c.name, text: r.text }], view: this.view() };
    });
  }

  /** Ce que le personnage sait et voit — et rien d'autre. */
  perspective(c: Character): CharacterPerspective {
    const loc = this.world.locations[c.locationId];
    const others = Object.values(this.world.characters).filter((o) => o.locationId === c.locationId && o.id !== c.id);
    const presentPeople = others.map((o) => o.name);
    if (this.world.player.locationId === c.locationId) presentPeople.push('un voyageur');
    return {
      character: { id: c.id, name: c.name, background: c.background, personality: c.personality, mood: c.mood },
      memory: c.memory.map((m) => ({ ...m })),
      surroundings: {
        locationName: loc.name,
        locationDescription: loc.description,
        visibleThings: loc.elements.filter((e) => !e.characterId && !e.tags.includes('fond')).map((e) => e.name),
        presentPeople,
      },
    };
  }

  /** Réactions spontanées des personnages présents à ce qu'ils viennent de percevoir. */
  private async collectReactions(): Promise<DialogueLine[]> {
    const perceived = this.pending;
    this.pending = [];
    const here = this.world.player.locationId;
    const latest = new Map<string, (typeof perceived)[number]>();
    for (const p of perceived) {
      const c = this.world.characters[p.characterId];
      if (c.locationId !== here || p.actorId === c.id || p.entry.channel === 'lived' || p.salience < 2) continue;
      latest.set(c.id, p);
    }
    const lines: DialogueLine[] = [];
    for (const [cid, p] of latest) {
      const c = this.world.characters[cid];
      const r = await this.providers.dialogue.react(this.perspective(c), p.entry);
      if (!r) continue;
      if (r.mood) c.mood = r.mood;
      this.recordEvents([{ actorId: c.id, kind: 'speech', description: `${c.name} dit : « ${r.text} »`, perception: 'audible', salience: 1 }], here);
      lines.push({ speakerId: c.id, speakerName: c.name, text: r.text });
    }
    this.pending = [];
    return lines;
  }

  // -------------------------------------------------------------------------
  // Déplacements
  // -------------------------------------------------------------------------

  travel(exitId: string): Promise<TravelResponse> {
    return this.run(() => this.doTravel(exitId));
  }

  private async doTravel(exitId: string): Promise<TravelResponse> {
    const from = this.currentLocation;
    const exit = from.exits.find((x) => x.id === exitId);
    if (!exit) throw new HttpError(400, `Sortie introuvable : ${exitId}`);
    const exitEl = from.elements.find((e) => e.id === exit.elementId);
    this.world.turn++;
    this.pending = [];
    this.recordEvents(
      [{ actorId: 'player', kind: 'departure', description: `Le voyageur s'en va par ${withArticle(exitEl?.name ?? exit.label)}.`, perception: 'visible', salience: 1 }],
      from.id,
    );

    let generated = false;
    let target = exit.targetLocationId ? this.world.locations[exit.targetLocationId] : undefined;
    if (!target) {
      // Lieu jamais visité : on le génère à la volée, cohérent avec celui qu'on quitte.
      const draft = await this.providers.locations.next(from, exit, this.world);
      target = await this.buildLocation(draft, { location: from, exit });
      exit.targetLocationId = target.id;
      generated = true;
    }
    // Sinon : le lieu (image + éléments + états) est restauré tel qu'on l'avait laissé.
    this.world.player.locationId = target.id;
    this.actionCache.clear();
    this.pending = [];
    this.recordEvents(
      [{ actorId: 'player', kind: 'arrival', description: `Un voyageur arrive depuis ${withArticle(from.name, { keepCase: true })}.`, perception: 'visible', salience: 2 }],
      target.id,
    );
    this.bus.emit('location:entered', { locationId: target.id, generated });
    const reactions = await this.collectReactions();
    return {
      view: this.view(),
      narration: generated ? target.description : `Vous revenez dans ${withArticle(target.name, { keepCase: true })}.`,
      reactions,
      generated,
    };
  }

  // -------------------------------------------------------------------------

  private recordEvents(drafts: WorldEventDraft[], locationId: string): WorldEvent[] {
    return drafts.map((d) => {
      const event: WorldEvent = { ...d, id: this.nextId('ev'), turn: this.world.turn, locationId: d.locationId ?? locationId };
      this.world.history.push(event);
      this.bus.emit('world:event', event);
      return event;
    });
  }

  toJSON(): { id: string; world: WorldState } {
    return { id: this.id, world: this.world };
  }
}

function clampRegion(r: BBox): BBox {
  const x = clamp(r.x, 0, 1);
  const y = clamp(r.y, 0, 1);
  return { x, y, w: clamp(r.w, 0.001, 1 - x), h: clamp(r.h, 0.001, 1 - y) };
}
