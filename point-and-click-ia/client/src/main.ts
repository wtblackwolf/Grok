/** Point d'entrée du client : assemble les composants. */
import './style.css';
import { GameController } from './game/GameController';
import { PointerController } from './input/PointerController';
import { SceneRenderer } from './scene/SceneRenderer';
import { DialoguePanel } from './ui/DialoguePanel';
import { LabelBar } from './ui/LabelBar';
import { RadialWheel } from './ui/RadialWheel';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const scene = new SceneRenderer($<HTMLCanvasElement>('scene'));
new PointerController($('stage'));
const dialogue = new DialoguePanel($('dialogue'), $('dialogue-log'), $<HTMLFormElement>('dialogue-form'), $<HTMLInputElement>('dialogue-input'), $('dialogue-title'), $('dialogue-close'));

// Les interactions dans le panneau de dialogue ne doivent pas déclencher de gestes sur la scène.
$('dialogue').addEventListener('pointerdown', (e) => e.stopPropagation());

const game = new GameController({
  scene,
  wheel: new RadialWheel($('wheel')),
  label: new LabelBar($('label-name'), $('label-narration')),
  dialogue,
  hud: { locationName: $('location-name'), inventory: $('inventory'), loading: $('loading') },
});

$('btn-outlines').addEventListener('click', (e) => {
  scene.showOutlines = !scene.showOutlines;
  (e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(scene.showOutlines));
  scene.render();
});
$('btn-dialogue').addEventListener('click', () => dialogue.toggle());
$('btn-new').addEventListener('click', () => void game.start());

void game.start();
