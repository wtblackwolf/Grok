/** Événements typés du bus interne d'une session de jeu. */
import type { ImagePatch, MemoryEntry, PatchOp, WorldEvent } from '@pnc/shared';

export type SessionEvents = {
  /** Un événement diégétique vient d'avoir lieu. */
  'world:event': WorldEvent;
  /** Un personnage a mémorisé quelque chose. */
  'memory:added': { characterId: string; entry: MemoryEntry; salience: number; actorId: string };
  'patch:applied': { applied: PatchOp[]; warnings: string[] };
  'image:patched': ImagePatch;
  'location:entered': { locationId: string; generated: boolean };
};
