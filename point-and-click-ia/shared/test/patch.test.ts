import { describe, expect, it } from 'vitest';
import { applyPatch } from '../src/patch';
import { mergeRegionElements } from '../src/merge';
import { rectPolygon } from '../src/geometry';
import type { SceneElement, WorldState } from '../src/types';

const element = (id: string, name: string, x: number, y: number, w = 0.1, h = 0.1): SceneElement => {
  const bbox = { x, y, w, h };
  return { id, name, description: name, bbox, polygon: rectPolygon(bbox), z: 1, state: {}, tags: [] };
};

const world = (): WorldState => ({
  turn: 0,
  player: { name: 'Voyageur', locationId: 'L1' },
  inventory: [],
  history: [],
  characters: {
    c1: { id: 'c1', name: 'Marthe', background: '', personality: '', mood: 'calme', locationId: 'L1', memory: [] },
  },
  locations: {
    L1: {
      id: 'L1',
      name: 'Taverne',
      description: '',
      image: { id: 'i', url: '/i', width: 10, height: 10 },
      imageVersion: 0,
      createdAtTurn: 0,
      elements: [element('e1', 'Lampe', 0.1, 0.1), element('e2', 'Porte', 0.7, 0.2)],
      exits: [{ id: 'x1', elementId: 'e2', label: 'Porte' }],
    },
  },
});

describe('applyPatch', () => {
  it('applique les opérations sans muter l’état d’origine', () => {
    const w = world();
    const { world: next, warnings } = applyPatch(w, [
      { op: 'setElementState', locationId: 'L1', elementId: 'e1', state: { allumé: true } },
      { op: 'addItem', item: { id: 'k', name: 'Clé', description: '', tags: [] } },
      { op: 'setCharacter', characterId: 'c1', changes: { mood: 'ravie' } },
      { op: 'renameElement', locationId: 'L1', elementId: 'e1', name: 'Lampe allumée' },
    ]);
    expect(warnings).toEqual([]);
    expect(next.locations.L1.elements[0].state).toEqual({ allumé: true });
    expect(next.locations.L1.elements[0].name).toBe('Lampe allumée');
    expect(next.inventory.map((i) => i.id)).toEqual(['k']);
    expect(next.characters.c1.mood).toBe('ravie');
    expect(w.locations.L1.elements[0].state).toEqual({});
    expect(w.inventory).toEqual([]);
  });

  it('ignore les opérations invalides en les signalant', () => {
    const { world: next, applied, warnings } = applyPatch(world(), [
      { op: 'setElementState', locationId: 'L1', elementId: 'nope', state: { a: 1 } },
      { op: 'removeItem', itemId: 'absent' },
      { op: 'removeElement', locationId: 'L1', elementId: 'e2' },
    ]);
    expect(warnings).toHaveLength(2);
    expect(applied).toHaveLength(1);
    expect(next.locations.L1.elements.map((e) => e.id)).toEqual(['e1']);
    expect(next.locations.L1.exits).toEqual([]); // la sortie portée par l'élément disparaît aussi
  });
});

describe('mergeRegionElements', () => {
  it('ne remplace que les éléments de la région et conserve ids/états', () => {
    const lamp = { ...element('e1', 'Lampe', 0.1, 0.1), state: { allumé: true }, sourceRef: 'lamp' };
    const door = element('e2', 'Porte', 0.7, 0.2);
    let n = 0;
    const merged = mergeRegionElements(
      [lamp, door],
      [
        { name: 'Lampe', description: 'x', bbox: lamp.bbox, polygon: lamp.polygon, z: 3, tags: ['lumière'], sourceRef: 'lamp' },
        { name: 'Éclats', description: 'verre', bbox: { x: 0.12, y: 0.12, w: 0.02, h: 0.02 }, polygon: [], z: 4, tags: [] },
        { name: 'Hors région', description: '', bbox: { x: 0.9, y: 0.9, w: 0.05, h: 0.05 }, polygon: [], z: 1, tags: [] },
      ],
      { x: 0, y: 0, w: 0.3, h: 0.3 },
      () => `new-${++n}`,
    );
    expect(merged.map((e) => e.id).sort()).toEqual(['e1', 'e2', 'new-1']);
    expect(merged.find((e) => e.id === 'e1')?.state).toEqual({ allumé: true });
    expect(merged.find((e) => e.id === 'e1')?.z).toBe(3);
  });

  it('retire les éléments de la région que la vision ne voit plus (objet ramassé)', () => {
    const key = element('k', 'Clé', 0.1, 0.1);
    const merged = mergeRegionElements([key], [], { x: 0, y: 0, w: 0.3, h: 0.3 }, () => 'x');
    expect(merged).toEqual([]);
  });
});
