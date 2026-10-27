import { describe, expect, it } from 'vitest';
import { GestureTracker } from '../src/input/gesture';

describe('GestureTracker (tap / appui long / glisser)', () => {
  it('un appui bref est un tap', () => {
    const g = new GestureTracker(400, 12);
    g.down({ x: 10, y: 10 }, 0);
    expect(g.up({ x: 11, y: 10 }, 120)).toEqual([{ type: 'tap', at: { x: 10, y: 10 } }]);
  });

  it('un appui maintenu 400 ms ouvre la roue, puis glisser et relâcher', () => {
    const g = new GestureTracker(400, 12);
    g.down({ x: 100, y: 100 }, 0);
    expect(g.tick(300)).toEqual([]);
    expect(g.tick(400)).toEqual([{ type: 'longpress', at: { x: 100, y: 100 } }]);
    expect(g.move({ x: 100, y: 40 }, 500)).toEqual([{ type: 'drag', at: { x: 100, y: 40 } }]);
    expect(g.up({ x: 100, y: 40 }, 600)).toEqual([{ type: 'release', at: { x: 100, y: 40 } }]);
    expect(g.phase).toBe('idle');
  });

  it('bouger avant le délai annule tap et appui long', () => {
    const g = new GestureTracker(400, 12);
    g.down({ x: 0, y: 0 }, 0);
    g.move({ x: 30, y: 0 }, 100);
    expect(g.tick(500)).toEqual([]);
    expect(g.up({ x: 30, y: 0 }, 600)).toEqual([]);
  });

  it('pointercancel pendant la roue émet cancel', () => {
    const g = new GestureTracker(400, 12);
    g.down({ x: 0, y: 0 }, 0);
    g.tick(450);
    expect(g.cancel()).toEqual([{ type: 'cancel' }]);
  });
});
