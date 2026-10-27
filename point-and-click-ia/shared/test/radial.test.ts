import { describe, expect, it } from 'vitest';
import { clampWheelCenter, radialIndexAt, radialItemPosition, radialPick } from '../src/radial';

describe('roue radiale', () => {
  it('annule dans la zone morte centrale', () => {
    expect(radialIndexAt(5, 5, 6, 20)).toBeNull();
    expect(radialIndexAt(100, 0, 0, 20)).toBeNull();
  });

  it('sélectionne dans le sens horaire depuis le haut (4 items)', () => {
    expect(radialIndexAt(0, -50, 4, 20)).toBe(0); // haut
    expect(radialIndexAt(50, 0, 4, 20)).toBe(1); // droite
    expect(radialIndexAt(0, 50, 4, 20)).toBe(2); // bas
    expect(radialIndexAt(-50, 0, 4, 20)).toBe(3); // gauche
    expect(radialIndexAt(-10, -50, 4, 20)).toBe(0); // un peu à gauche du haut -> toujours 0
  });

  it('chaque item est sélectionné quand on glisse vers sa position (1 à 6 items)', () => {
    for (let count = 1; count <= 6; count++) {
      for (let i = 0; i < count; i++) {
        const p = radialItemPosition(i, count, 90);
        expect(radialIndexAt(p.x, p.y, count, 20)).toBe(i);
      }
    }
  });

  it('garde la roue dans l’écran', () => {
    expect(clampWheelCenter({ x: 10, y: 590 }, 120, 800, 600)).toEqual({ x: 120, y: 480 });
  });

  it('roue décalée au bord de l’écran : on vise l’item affiché, relâcher au point d’appui annule', () => {
    const origin = { x: 380, y: 300 }; // appui tout près du bord droit
    const center = clampWheelCenter(origin, 150, 400, 800); // roue décalée à gauche
    expect(center.x).toBe(250);
    for (let i = 0; i < 4; i++) {
      const p = radialItemPosition(i, 4, 100);
      expect(radialPick({ x: center.x + p.x, y: center.y + p.y }, origin, center, 4, 28)).toBe(i);
    }
    expect(radialPick({ x: 385, y: 305 }, origin, center, 4, 28)).toBeNull();
    // item affiché tout près du point d'appui : viser l'item l'emporte sur la zone morte
    const near = { x: 340, y: 300 }; // item « est » (index 1) d'une roue de rayon 90 centrée en 250
    expect(radialPick(near, { x: 345, y: 300 }, center, 4, 28, 90)).toBe(1);
  });
});
