/**
 * Application PURE d'un StatePatch au WorldState.
 * Le patch vient d'une IA : il peut être partiellement invalide. Les opérations invalides sont
 * ignorées et signalées dans `warnings` plutôt que de faire échouer tout le tour.
 */
import type { PatchOp, StatePatch, WorldState } from './types';

export interface PatchResult {
  world: WorldState;
  applied: PatchOp[];
  warnings: string[];
}

/** Copie profonde : le WorldState est garanti sérialisable en JSON. */
export function cloneWorld(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
}

export function applyPatch(world: WorldState, patch: StatePatch): PatchResult {
  const next = cloneWorld(world);
  const applied: PatchOp[] = [];
  const warnings: string[] = [];

  for (const op of patch) {
    const err = applyOp(next, op);
    if (err) warnings.push(`${op.op}: ${err}`);
    else applied.push(op);
  }
  return { world: next, applied, warnings };
}

/** Applique une opération en place ; renvoie un message d'erreur ou null. */
function applyOp(w: WorldState, op: PatchOp): string | null {
  switch (op.op) {
    case 'setElementState': {
      const el = w.locations[op.locationId]?.elements.find((e) => e.id === op.elementId);
      if (!el) return `élément introuvable ${op.locationId}/${op.elementId}`;
      el.state = { ...el.state, ...op.state };
      return null;
    }
    case 'renameElement': {
      const el = w.locations[op.locationId]?.elements.find((e) => e.id === op.elementId);
      if (!el) return `élément introuvable ${op.locationId}/${op.elementId}`;
      el.name = op.name;
      if (op.description !== undefined) el.description = op.description;
      return null;
    }
    case 'removeElement': {
      const loc = w.locations[op.locationId];
      if (!loc) return `lieu introuvable ${op.locationId}`;
      const before = loc.elements.length;
      loc.elements = loc.elements.filter((e) => e.id !== op.elementId);
      if (loc.elements.length === before) return `élément introuvable ${op.elementId}`;
      loc.exits = loc.exits.filter((x) => x.elementId !== op.elementId);
      return null;
    }
    case 'addElement': {
      const loc = w.locations[op.locationId];
      if (!loc) return `lieu introuvable ${op.locationId}`;
      if (loc.elements.some((e) => e.id === op.element.id)) return `id déjà utilisé ${op.element.id}`;
      loc.elements.push(op.element);
      return null;
    }
    case 'addItem': {
      if (w.inventory.some((i) => i.id === op.item.id)) return `objet déjà possédé ${op.item.id}`;
      w.inventory.push(op.item);
      return null;
    }
    case 'removeItem': {
      const before = w.inventory.length;
      w.inventory = w.inventory.filter((i) => i.id !== op.itemId);
      return w.inventory.length === before ? `objet introuvable ${op.itemId}` : null;
    }
    case 'setCharacter': {
      const c = w.characters[op.characterId];
      if (!c) return `personnage introuvable ${op.characterId}`;
      if (op.changes.locationId && !w.locations[op.changes.locationId]) return `lieu introuvable ${op.changes.locationId}`;
      Object.assign(c, op.changes);
      return null;
    }
    case 'setLocationDescription': {
      const loc = w.locations[op.locationId];
      if (!loc) return `lieu introuvable ${op.locationId}`;
      loc.description = op.description;
      return null;
    }
    case 'setExitTarget': {
      const exit = w.locations[op.locationId]?.exits.find((x) => x.id === op.exitId);
      if (!exit) return `sortie introuvable ${op.exitId}`;
      if (!w.locations[op.targetLocationId]) return `lieu introuvable ${op.targetLocationId}`;
      exit.targetLocationId = op.targetLocationId;
      return null;
    }
    default: {
      const never: never = op;
      return `opération inconnue ${JSON.stringify(never)}`;
    }
  }
}
