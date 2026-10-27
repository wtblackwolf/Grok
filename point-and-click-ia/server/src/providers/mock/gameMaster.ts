/**
 * GameMasterProvider MOCK.
 *
 * Il n'y a AUCUN script par scène : les actions sont déduites des étiquettes (tags) et de l'état
 * des éléments, exactement comme un LLM le ferait à partir de la description. C'est un stand-in
 * déterministe ; le vrai MJ (providers/llm) pourra inventer librement.
 */
import { MAX_ACTIONS, padBBox, bboxUnion, pick } from '@pnc/shared';
import type { BBox, GameAction, ImageEditRequest, SceneElement, StatePatch } from '@pnc/shared';
import type { ActionContext, ActionResolution, GameMasterProvider, WorldEventDraft } from '../ports';

type Draft = Omit<GameAction, 'elementId'>;
const on = (v: unknown) => v === true || v === 'true';
const has = (e: SceneElement, ...tags: string[]) => tags.some((t) => e.tags.includes(t));
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export class MockGameMaster implements GameMasterProvider {
  async describeActions({ element, world }: ActionContext): Promise<Draft[]> {
    const a: Draft[] = [];
    const add = (id: string, label: string, type: GameAction['type'] = 'world') => {
      if (!a.some((x) => x.id === id)) a.push({ id, label, type });
    };
    const st = element.state;

    if (element.characterId) {
      const c = world.characters[element.characterId];
      if (c && /endormi/.test(c.mood)) {
        add('wake', 'Réveiller');
        add('observe', 'Observer');
      } else {
        add('talk', 'Parler', 'talk');
        add('greet', 'Saluer');
        add('observe', 'Observer');
      }
      for (const item of world.inventory.slice(0, 2)) add(`give:${item.id}`, `Donner : ${item.name}`);
      add('examine', 'Examiner');
      return a.slice(0, MAX_ACTIONS);
    }

    add('examine', 'Examiner');
    if (element.exitId || has(element, 'sortie')) {
      if (has(element, 'porte')) {
        if (on(st.ouvert)) {
          add('go', 'Franchir', 'travel');
          add('close', 'Fermer');
        } else {
          add('open', 'Ouvrir');
          add('knock', 'Frapper');
          add('listen', 'Écouter');
        }
      } else {
        add('go', has(element, 'escalier') ? 'Emprunter l’escalier' : 'Emprunter le passage', 'travel');
        add('listen', 'Écouter');
      }
    } else if (has(element, 'ouvrable')) {
      if (on(st.ouvert)) add('close', 'Fermer');
      else if (!on(st.brisé)) add('open', 'Ouvrir');
      if (has(element, 'fenêtre') && (on(st.ouvert) || on(st.brisé))) add('look-out', 'Regarder dehors');
    }
    if ((has(element, 'contenant') && on(st.ouvert)) || has(element, 'fouillable')) add('search', 'Fouiller');
    if (has(element, 'lumière', 'feu')) on(st.allumé) ? add('extinguish', 'Éteindre') : add('light', 'Allumer');
    if (has(element, 'portable')) add('take', 'Prendre');
    if (has(element, 'fragile') && !on(st.brisé)) add('break', 'Briser');
    if (has(element, 'décrochable') && !on(st.décroché)) add('unhook', 'Décrocher');
    if (has(element, 'boisson')) add('drink', 'Tirer une chope');
    if (has(element, 'eau')) add('drink', 'Boire');
    if (has(element, 'siège', 'table')) add('sit', 'S’asseoir');
    if (has(element, 'arbre')) add('shake', 'Secouer les branches');
    if (has(element, 'enseigne', 'décor')) add('touch', 'Toucher');
    if (has(element, 'fond')) {
      add('touch', 'Toucher');
      add('secret', 'Chercher un passage secret');
    }
    if (a.length < 2) add('touch', 'Toucher');
    return a.slice(0, MAX_ACTIONS);
  }

  async resolveAction(action: GameAction, { element, location, world }: ActionContext): Promise<ActionResolution> {
    const name = element.name;
    const the = lower(name);
    const loc = location.id;
    const patch: StatePatch = [];
    const events: WorldEventDraft[] = [];
    const ev = (description: string, perception: WorldEventDraft['perception'] = 'visible', salience: 1 | 2 | 3 = 1, extra: Partial<WorldEventDraft> = {}) =>
      events.push({ actorId: 'player', kind: 'action', description, perception, salience, targetElementId: element.id, ...extra });
    const setState = (state: SceneElement['state']) => patch.push({ op: 'setElementState', locationId: loc, elementId: element.id, state });
    const edit = (prompt: string, subject: ImageEditRequest['subject'] = {}, extra?: BBox): ImageEditRequest => ({
      locationId: loc,
      region: padBBox(extra ? bboxUnion(element.bbox, extra) : element.bbox, 0.02),
      prompt,
      subject: { elementId: element.id, sourceRef: element.sourceRef, ...subject },
    });
    const character = element.characterId ? world.characters[element.characterId] : undefined;
    const st = element.state;

    const [verb, arg] = action.id.split(':');
    switch (verb) {
      case 'examine':
        ev(`Le voyageur examine attentivement ${the}.`);
        return { patch, events, narration: `${element.description}${stateNote(element)}` };
      case 'touch':
        ev(`Le voyageur passe la main sur ${the}.`);
        return { patch, events, narration: `${name} : ${pick(['froid et rugueux', 'tiède, étrangement', 'poisseux', 'lisse, usé par le temps'], element.id + world.turn)}.` };
      case 'secret':
        ev(`Le voyageur tâte ${the} à la recherche de quelque chose.`, 'visible', 2);
        return { patch, events, narration: 'Vous tâtonnez un long moment… rien. Pour l’instant.' };
      case 'open':
      case 'close': {
        const open = verb === 'open';
        setState({ ouvert: open });
        ev(`Le voyageur ${open ? 'ouvre' : 'ferme'} ${the}.`, 'visible', 2);
        let addBox: BBox | undefined;
        const add: NonNullable<ImageEditRequest['subject']>['add'] = [];
        let narration = open ? `${name} s'ouvre en grinçant.` : `${name} se referme.`;
        if (open && has(element, 'contenant') && typeof st.contient === 'string' && st.contient) {
          const b = element.bbox;
          addBox = { x: b.x + b.w * 0.3, y: b.y + b.h * 0.3, w: b.w * 0.4, h: b.h * 0.14 };
          add.push(revealed(st.contient, addBox));
          setState({ contient: '' });
          narration = `${name} s'ouvre. À l'intérieur : ${lower(st.contient)}.`;
        }
        return {
          patch,
          events,
          narration,
          imageEdit: edit(`${name}, maintenant ${open ? 'ouvert' : 'fermé'}`, { state: { ouvert: open }, add }, addBox),
        };
      }
      case 'search': {
        const content = typeof st.contient === 'string' ? st.contient : '';
        ev(`Le voyageur fouille ${the}.`, 'visible', 2);
        if (!content) return { patch, events, narration: 'Rien d’intéressant.' };
        const b = element.bbox;
        const box = { x: b.x + b.w * 0.3, y: Math.min(0.95, b.y + b.h + 0.01), w: Math.max(0.03, b.w * 0.4), h: 0.035 };
        setState({ contient: '' });
        return {
          patch,
          events,
          narration: `Vous trouvez : ${lower(content)}.`,
          imageEdit: edit(`Un objet (${content}) apparaît près de ${the}`, { add: [revealed(content, box)] }, box),
        };
      }
      case 'light':
      case 'extinguish': {
        const lit = verb === 'light';
        setState({ allumé: lit });
        ev(`Le voyageur ${lit ? 'allume' : 'éteint'} ${the}.`, 'visible', 2);
        return {
          patch,
          events,
          narration: lit ? `${name} s'allume ; une lueur chaude danse.` : `${name} s'éteint.`,
          imageEdit: edit(`${name}, ${lit ? 'allumé(e), lueur chaude' : 'éteint(e)'}`, { state: { allumé: lit } }),
        };
      }
      case 'take':
        patch.push(
          { op: 'addItem', item: { id: `item-${element.id}`, name, description: element.description, tags: element.tags } },
          { op: 'removeElement', locationId: loc, elementId: element.id },
        );
        ev(`Le voyageur prend ${the}.`, 'visible', 2);
        return { patch, events, narration: `Vous prenez ${the}.`, imageEdit: edit(`Retirer ${the}, montrer ce qu'il y a derrière`, { remove: true }) };
      case 'break':
        setState({ brisé: true, ouvert: false });
        ev(`Un fracas : le voyageur brise ${the} !`, 'audible', 3);
        return { patch, events, narration: `${name} vole en éclats.`, imageEdit: edit(`${name} brisé(e), éclats`, { state: { brisé: true } }) };
      case 'unhook':
        setState({ décroché: true });
        ev(`Le voyageur décroche ${the}.`, 'visible', 2);
        return { patch, events, narration: 'Derrière, une tache plus claire sur le mur… et rien d’autre.', imageEdit: edit(`${name} décroché`, { state: { décroché: true } }) };
      case 'knock':
        ev(`On frappe à ${the}.`, 'audible', 2);
        return { patch, events, narration: 'Toc, toc, toc… Personne ne répond.' };
      case 'listen':
        ev(`Le voyageur colle l'oreille contre ${the}.`);
        return { patch, events, narration: pick(['Le vent, au loin.', 'Des pas, peut-être ?', 'Un clapotis régulier.', 'Rien. Un silence épais.'], element.id) };
      case 'look-out':
        ev(`Le voyageur regarde par ${the}.`);
        return { patch, events, narration: 'Dehors, la nuit et la brume du port.' };
      case 'drink':
        ev(`Le voyageur boit à ${the}.`);
        return { patch, events, narration: 'Ça réchauffe… ou ça rafraîchit, selon.' };
      case 'sit':
        ev(`Le voyageur s'installe près de ${the}.`);
        return { patch, events, narration: 'Vous vous posez un instant. Personne ne vous presse.' };
      case 'shake':
        ev(`Le voyageur secoue ${the}.`, 'visible', 2);
        return { patch, events, narration: 'Quelques feuilles tombent en tourbillonnant.' };
      case 'go':
        return { patch, events, travelExitId: element.exitId };
      case 'greet':
        ev(`Le voyageur salue ${character?.name ?? the} d'un signe de tête.`, 'visible', 2, { targetCharacterId: character?.id });
        return { patch, events };
      case 'observe':
        ev(`Le voyageur dévisage ${character?.name ?? the}.`, 'visible', 1, { targetCharacterId: character?.id });
        return { patch, events, narration: `${element.description}${character ? ` Humeur : ${character.mood}.` : ''}` };
      case 'wake': {
        if (!character) return { patch, events };
        patch.push({ op: 'setCharacter', characterId: character.id, changes: { mood: 'grognon' } });
        setState({ humeur: 'grognon' });
        ev(`Le voyageur secoue ${character.name} pour le réveiller.`, 'audible', 3, { targetCharacterId: character.id });
        return { patch, events, narration: `${character.name} sursaute en grognant.`, imageEdit: edit(`${character.name} réveillé, air grognon`, { state: { humeur: 'grognon' } }) };
      }
      case 'give': {
        const item = world.inventory.find((i) => i.id === arg);
        if (!item || !character) return { patch, events, narration: 'Vous n’avez rien à donner.' };
        patch.push(
          { op: 'removeItem', itemId: item.id },
          { op: 'setCharacter', characterId: character.id, changes: { mood: 'ravie' } },
        );
        setState({ humeur: 'ravie' });
        ev(`Le voyageur offre ${lower(item.name)} à ${character.name}.`, 'visible', 3, { targetCharacterId: character.id });
        return { patch, events, imageEdit: edit(`${character.name} sourit`, { state: { humeur: 'ravie' } }) };
      }
      default:
        ev(`Le voyageur tente quelque chose avec ${the}.`);
        return { patch, events, narration: 'Il ne se passe rien de notable.' };
    }
  }
}

function stateNote(e: SceneElement): string {
  const notes: string[] = [];
  if (e.state.allumé === true) notes.push('Allumé.');
  if (e.state.allumé === false && e.tags.includes('lumière')) notes.push('Éteint.');
  if (e.state.ouvert === true) notes.push('Ouvert.');
  if (e.state.brisé === true) notes.push('Brisé.');
  return notes.length ? ` (${notes.join(' ')})` : '';
}

function revealed(name: string, bbox: BBox) {
  const kind = /clé/i.test(name) ? 'key' : 'item';
  return { kind, name, description: `${name}, que vous venez de découvrir.`, tags: ['objet', 'portable'], bbox };
}
