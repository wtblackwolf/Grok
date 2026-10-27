/**
 * Chef d'orchestre côté client : relie gestes, scène, roue, dialogues et API.
 * Toute la logique de jeu est côté serveur ; le client affiche et transmet des intentions.
 */
import type { DialogueLine, GameView, ImagePatch } from '@pnc/shared';
import { api } from '../api';
import { bus } from '../bus';
import type { SceneRenderer } from '../scene/SceneRenderer';
import type { DialoguePanel } from '../ui/DialoguePanel';
import type { LabelBar } from '../ui/LabelBar';
import type { RadialWheel } from '../ui/RadialWheel';
import { LocationCache } from './LocationCache';

export interface ControllerDeps {
  scene: SceneRenderer;
  wheel: RadialWheel;
  label: LabelBar;
  dialogue: DialoguePanel;
  hud: { locationName: HTMLElement; inventory: HTMLElement; loading: HTMLElement };
}

export class GameController {
  private view: GameView | null = null;
  private cache = new LocationCache();
  private wheelElementId: string | null = null;
  private wheelRequest = 0;
  private busy = false;

  constructor(private d: ControllerDeps) {
    bus.on('pointer:tap', ({ client }) => this.onTap(client.x, client.y));
    bus.on('pointer:longpress', ({ client }) => void this.onLongPress(client.x, client.y));
    bus.on('pointer:drag', ({ client }) => d.wheel.drag(client));
    bus.on('pointer:release', ({ client }) => {
      const action = d.wheel.release(client);
      const elementId = this.wheelElementId;
      this.wheelElementId = null;
      if (action && elementId) void this.perform(elementId, action.id, action.type === 'talk');
    });
    bus.on('pointer:cancel', () => d.wheel.close());
    bus.on('busy', ({ busy }) => d.hud.loading.classList.toggle('hidden', !busy));
    d.dialogue.onSay = (characterId, text) => void this.say(characterId, text);
  }

  async start(): Promise<void> {
    this.setBusy(true);
    try {
      this.cache.clear();
      const res = await api.newSession();
      await this.applyView(res.view, null);
      this.d.label.narrate(res.narration);
      this.d.dialogue.clearTarget();
    } catch (err) {
      this.error(err);
    } finally {
      this.setBusy(false);
    }
  }

  // ---------------------------------------------------------------------------

  private onTap(x: number, y: number): void {
    const el = this.d.scene.pick(x, y);
    this.d.scene.select(el?.id ?? null);
    this.d.label.showName(el?.name ?? null);
    bus.emit('element:selected', { elementId: el?.id ?? null, name: el?.name ?? null });
  }

  /** Appui long : ouvre la roue tout de suite, les actions arrivent de l'IA pendant ce temps. */
  private async onLongPress(x: number, y: number): Promise<void> {
    if (!this.view || this.busy) return;
    const el = this.d.scene.pick(x, y);
    if (!el) return;
    this.d.scene.select(el.id);
    this.d.label.showName(el.name);
    this.wheelElementId = el.id;
    this.d.wheel.show({ x, y }, el.name);
    const req = ++this.wheelRequest;
    try {
      const { actions } = await api.actions(this.view.sessionId, el.id);
      if (req === this.wheelRequest) this.d.wheel.setItems(actions);
    } catch (err) {
      if (req === this.wheelRequest) this.d.wheel.setError('indisponible');
      console.error(err);
    }
  }

  private async perform(elementId: string, actionId: string, isTalk: boolean): Promise<void> {
    if (!this.view) return;
    this.setBusy(true);
    try {
      const res = await api.act(this.view.sessionId, elementId, actionId);
      if (isTalk || res.openDialogueWith) {
        const c = res.view.location.characters.find((ch) => ch.id === res.openDialogueWith);
        if (c) this.d.dialogue.open({ id: c.id, name: c.name });
      }
      await this.applyView(res.view, res.imagePatch ?? null);
      this.d.label.narrate(res.narration);
      if (res.travelled) this.d.dialogue.clearTarget();
      this.showLines(res.reactions);
    } catch (err) {
      this.error(err);
    } finally {
      this.setBusy(false);
    }
  }

  private async say(characterId: string, text: string): Promise<void> {
    if (!this.view) return;
    try {
      const res = await api.talk(this.view.sessionId, characterId, text);
      this.view = res.view;
      this.showLines(res.lines);
    } catch (err) {
      this.error(err);
    }
  }

  private showLines(lines: DialogueLine[]): void {
    if (!lines.length) return;
    for (const l of lines) this.d.dialogue.append(l);
    this.d.dialogue.open();
  }

  /**
   * Applique une nouvelle vue :
   *  - même lieu + patch : on ne recompose QUE la région ;
   *  - changement de lieu : on sauvegarde l'instantané du lieu quitté, puis on restaure
   *    l'instantané du lieu d'arrivée s'il existe (sinon on charge son image).
   */
  private async applyView(view: GameView, patch: ImagePatch | null): Promise<void> {
    const prev = this.view;
    const sameLocation = prev?.location.id === view.location.id;

    if (patch && prev && patch.locationId === prev.location.id) {
      await this.d.scene.applyPatch(patch);
    }

    if (!sameLocation) {
      if (prev) this.cache.save(prev.location.id, { imageId: this.d.scene.currentImageId, canvas: this.d.scene.snapshot() });
      const snap = this.cache.get(view.location.id, view.location.image.id);
      if (snap) this.d.scene.restore(snap.canvas, snap.imageId, view.location.elements);
      else await this.d.scene.showLocation(view.location);
      this.d.scene.select(null);
      this.d.label.showName(null);
      this.d.dialogue.append({ speakerId: 'sys', speakerName: '', text: `— ${view.location.name} —` }, 'system');
    } else if (this.d.scene.currentImageId !== view.location.image.id) {
      // Désynchronisation (ex. patch manqué) : on recharge l'image complète.
      await this.d.scene.showLocation(view.location);
    } else {
      this.d.scene.setElements(view.location.elements);
    }

    this.view = view;
    this.renderHud();
  }

  private renderHud(): void {
    if (!this.view) return;
    const { hud } = this.d;
    hud.locationName.textContent = this.view.location.name;
    hud.inventory.replaceChildren(
      ...this.view.inventory.map((i) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = i.name;
        chip.title = i.description;
        return chip;
      }),
    );
  }

  private setBusy(b: boolean): void {
    this.busy = b;
    bus.emit('busy', { busy: b });
  }

  private error(err: unknown): void {
    console.error(err);
    this.d.label.narrate(`⚠ ${err instanceof Error ? err.message : String(err)}`);
  }
}
