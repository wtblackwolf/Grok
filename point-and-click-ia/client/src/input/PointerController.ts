/** Branche le GestureTracker sur les Pointer Events d'un élément et publie sur le bus. */
import { bus } from '../bus';
import { GestureTracker, LONG_PRESS_MS, type Gesture } from './gesture';

export class PointerController {
  private tracker = new GestureTracker();
  private timer: number | undefined;
  private activePointer: number | null = null;

  constructor(private target: HTMLElement) {
    target.addEventListener('pointerdown', this.onDown);
    target.addEventListener('pointermove', this.onMove);
    target.addEventListener('pointerup', this.onUp);
    target.addEventListener('pointercancel', this.onCancel);
    target.addEventListener('lostpointercapture', this.onCancel);
    target.addEventListener('contextmenu', (e) => e.preventDefault()); // appui long mobile / clic droit
  }

  private onDown = (e: PointerEvent) => {
    if (this.activePointer !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    this.activePointer = e.pointerId;
    this.target.setPointerCapture(e.pointerId);
    this.dispatch(this.tracker.down({ x: e.clientX, y: e.clientY }, performance.now()));
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.dispatch(this.tracker.tick(performance.now())), LONG_PRESS_MS + 5);
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.activePointer) return;
    this.dispatch(this.tracker.move({ x: e.clientX, y: e.clientY }, performance.now()));
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.activePointer) return;
    this.activePointer = null;
    window.clearTimeout(this.timer);
    this.dispatch(this.tracker.up({ x: e.clientX, y: e.clientY }, performance.now()));
  };

  private onCancel = (e: PointerEvent) => {
    if (e.pointerId !== this.activePointer) return;
    this.activePointer = null;
    window.clearTimeout(this.timer);
    this.dispatch(this.tracker.cancel());
  };

  private dispatch(gestures: Gesture[]) {
    for (const g of gestures) {
      if (g.type === 'tap') bus.emit('pointer:tap', { client: g.at });
      else if (g.type === 'longpress') bus.emit('pointer:longpress', { client: g.at });
      else if (g.type === 'drag') bus.emit('pointer:drag', { client: g.at });
      else if (g.type === 'release') bus.emit('pointer:release', { client: g.at });
      else bus.emit('pointer:cancel');
    }
  }
}
