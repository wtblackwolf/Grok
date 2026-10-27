import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/eventBus';

type Events = { ping: { n: number }; reset: void };

describe('EventBus', () => {
  it('délivre les payloads typés aux abonnés dans l’ordre', () => {
    const bus = new EventBus<Events>();
    const seen: number[] = [];
    bus.on('ping', (p) => seen.push(p.n));
    bus.on('ping', (p) => seen.push(p.n * 10));
    bus.emit('ping', { n: 2 });
    expect(seen).toEqual([2, 20]);
  });

  it('se désabonne via la fonction renvoyée et off()', () => {
    const bus = new EventBus<Events>();
    const h = vi.fn();
    const off = bus.on('ping', h);
    off();
    bus.emit('ping', { n: 1 });
    expect(h).not.toHaveBeenCalled();
    expect(bus.listenerCount('ping')).toBe(0);
  });

  it('once() ne déclenche qu’une fois', () => {
    const bus = new EventBus<Events>();
    const h = vi.fn();
    bus.once('reset', h);
    bus.emit('reset');
    bus.emit('reset');
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('isole les erreurs d’un handler', () => {
    const bus = new EventBus<Events>();
    const errors: string[] = [];
    bus.onError = (_e, t) => errors.push(t);
    const after = vi.fn();
    bus.on('ping', () => {
      throw new Error('boom');
    });
    bus.on('ping', after);
    bus.emit('ping', { n: 1 });
    expect(after).toHaveBeenCalled();
    expect(errors).toEqual(['ping']);
  });
});
