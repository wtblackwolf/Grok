import { describe, expect, it } from 'vitest';
import {
  ellipsePolygon,
  fitContain,
  hitTest,
  pointInPolygon,
  rectPolygon,
  screenToNormalized,
  toPixelRect,
  bboxOfPolygon,
} from '../src/geometry';

const el = (id: string, x: number, y: number, w: number, h: number, z = 0) => {
  const bbox = { x, y, w, h };
  return { id, bbox, polygon: rectPolygon(bbox), z };
};

describe('géométrie & hit-testing', () => {
  it('pointInPolygon gère un polygone concave', () => {
    const L = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0.2 },
      { x: 0.2, y: 0.2 },
      { x: 0.2, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(pointInPolygon({ x: 0.1, y: 0.5 }, L)).toBe(true);
    expect(pointInPolygon({ x: 0.5, y: 0.5 }, L)).toBe(false);
  });

  it('hitTest privilégie le z le plus haut puis la plus petite aire', () => {
    const wall = el('mur', 0, 0, 1, 1, 0);
    const table = el('table', 0.3, 0.5, 0.4, 0.2, 1);
    const lamp = el('lampe', 0.45, 0.4, 0.1, 0.15, 1);
    const elements = [wall, table, lamp];
    expect(hitTest(elements, { x: 0.5, y: 0.45 })?.id).toBe('lampe');
    expect(hitTest(elements, { x: 0.35, y: 0.6 })?.id).toBe('table');
    expect(hitTest(elements, { x: 0.05, y: 0.05 })?.id).toBe('mur');
    expect(hitTest([table], { x: 0.05, y: 0.05 })).toBeNull();
  });

  it('hitTest respecte le contour réel (ellipse), pas seulement la bbox', () => {
    const bbox = { x: 0, y: 0, w: 1, h: 1 };
    const round = { id: 'rond', bbox, polygon: ellipsePolygon(bbox, 32), z: 0 };
    expect(hitTest([round], { x: 0.5, y: 0.5 })?.id).toBe('rond');
    expect(hitTest([round], { x: 0.02, y: 0.02 })).toBeNull();
  });

  it('convertit écran -> normalisé avec letterboxing', () => {
    const fit = fitContain(1000, 1000, 1280, 720); // bandes en haut et en bas
    expect(fit.offsetX).toBe(0);
    expect(fit.offsetY).toBeCloseTo((1000 - 562.5) / 2);
    expect(screenToNormalized(500, 500, fit)).toEqual({ x: 0.5, y: 0.5 });
    expect(screenToNormalized(500, 10, fit)).toBeNull();
  });

  it('toPixelRect couvre entièrement la région', () => {
    expect(toPixelRect({ x: 0.1, y: 0.1, w: 0.2, h: 0.3 }, 1280, 720)).toEqual({ x: 128, y: 72, w: 256, h: 216 });
    const b = bboxOfPolygon(rectPolygon({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }));
    expect(b.w).toBeCloseTo(0.3);
    expect(b.h).toBeCloseTo(0.4);
  });
});
