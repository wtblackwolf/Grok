/**
 * Branche le système de perception (logique pure dans @pnc/shared) sur le bus de la session :
 * chaque WorldEvent émis est distribué dans la mémoire des personnages qui le perçoivent.
 */
import { perceive, remember, type EventBus } from '@pnc/shared';
import type { WorldState } from '@pnc/shared';
import type { SessionEvents } from './events';

export class PerceptionSystem {
  constructor(bus: EventBus<SessionEvents>, getWorld: () => WorldState) {
    bus.on('world:event', (event) => {
      const world = getWorld();
      for (const p of perceive(Object.values(world.characters), event)) {
        const c = world.characters[p.characterId];
        remember(c, p.entry);
        bus.emit('memory:added', { ...p, salience: event.salience, actorId: event.actorId });
      }
    });
  }
}
