/**
 * Reconnaissance de gestes indépendante du DOM (testable) : tap vs appui long + glisser.
 * Fonctionne pareil au doigt et à la souris (Pointer Events).
 */
import type { Vec2 } from '@pnc/shared';

export const LONG_PRESS_MS = 400;
/** Au-delà de ce déplacement avant l'appui long, ce n'est plus un tap ni un appui long. */
export const MOVE_TOLERANCE_PX = 12;

export type Gesture =
  | { type: 'tap'; at: Vec2 }
  | { type: 'longpress'; at: Vec2 }
  | { type: 'drag'; at: Vec2 }
  | { type: 'release'; at: Vec2 }
  | { type: 'cancel' };

type State = { phase: 'idle' } | { phase: 'pressing'; start: Vec2; t0: number; moved: boolean } | { phase: 'wheel' };

export class GestureTracker {
  private state: State = { phase: 'idle' };

  constructor(
    private longPressMs = LONG_PRESS_MS,
    private tolerance = MOVE_TOLERANCE_PX,
  ) {}

  get phase(): State['phase'] {
    return this.state.phase;
  }

  down(at: Vec2, t: number): Gesture[] {
    this.state = { phase: 'pressing', start: at, t0: t, moved: false };
    return [];
  }

  /** À appeler par un minuteur ~longPressMs après down (et/ou à chaque move). */
  tick(t: number): Gesture[] {
    const s = this.state;
    if (s.phase === 'pressing' && !s.moved && t - s.t0 >= this.longPressMs) {
      this.state = { phase: 'wheel' };
      return [{ type: 'longpress', at: s.start }];
    }
    return [];
  }

  move(at: Vec2, t: number): Gesture[] {
    const s = this.state;
    if (s.phase === 'pressing') {
      const out = this.tick(t);
      if (out.length) return [...out, { type: 'drag', at }];
      if (Math.hypot(at.x - s.start.x, at.y - s.start.y) > this.tolerance) s.moved = true;
      return [];
    }
    if (s.phase === 'wheel') return [{ type: 'drag', at }];
    return [];
  }

  up(at: Vec2, t: number): Gesture[] {
    const s = this.state;
    this.state = { phase: 'idle' };
    if (s.phase === 'wheel') return [{ type: 'release', at }];
    if (s.phase === 'pressing' && !s.moved) {
      // Relâché avant le délai : tap. (Si le délai est dépassé sans tick, c'est quand même un appui long annulé.)
      return t - s.t0 < this.longPressMs ? [{ type: 'tap', at: s.start }] : [{ type: 'longpress', at: s.start }, { type: 'release', at }];
    }
    return [];
  }

  cancel(): Gesture[] {
    const wasWheel = this.state.phase === 'wheel';
    this.state = { phase: 'idle' };
    return wasWheel ? [{ type: 'cancel' }] : [];
  }
}
