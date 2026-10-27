/** Géométrie 2D en coordonnées normalisées : hit-testing, boîtes, letterboxing. */
import type { BBox, PixelRect, Polygon, Vec2 } from './types';

export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

/** Test point-dans-polygone (ray casting, règle pair-impair). */
export function pointInPolygon(p: Vec2, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const intersect = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function bboxOfPolygon(poly: Polygon): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!poly.length) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function bboxContains(b: BBox, p: Vec2): boolean {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

export function bboxCenter(b: BBox): Vec2 {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

export function bboxIntersects(a: BBox, b: BBox): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function bboxUnion(...boxes: BBox[]): BBox {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w));
  const bt = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: r - x, h: bt - y };
}

/** Agrandit une boîte d'une marge et la borne à [0,1]. */
export function padBBox(b: BBox, pad: number): BBox {
  const x = clamp(b.x - pad, 0, 1);
  const y = clamp(b.y - pad, 0, 1);
  const r = clamp(b.x + b.w + pad, 0, 1);
  const bt = clamp(b.y + b.h + pad, 0, 1);
  return { x, y, w: r - x, h: bt - y };
}

export function polygonArea(poly: Polygon): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  }
  return Math.abs(a / 2);
}

export function rectPolygon(b: BBox): Polygon {
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ];
}

export function ellipsePolygon(b: BBox, segments = 16): Polygon {
  const c = bboxCenter(b);
  const pts: Polygon = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push({ x: c.x + (Math.cos(t) * b.w) / 2, y: c.y + (Math.sin(t) * b.h) / 2 });
  }
  return pts;
}

/** Région normalisée -> rectangle en pixels entiers couvrant entièrement la région. */
export function toPixelRect(b: BBox, width: number, height: number): PixelRect {
  const EPS = 1e-6; // absorbe les erreurs d'arrondi flottant (0.3 * 1280 = 384.00000000000006)
  const x = Math.floor(clamp(b.x, 0, 1) * width + EPS);
  const y = Math.floor(clamp(b.y, 0, 1) * height + EPS);
  const r = Math.ceil(clamp(b.x + b.w, 0, 1) * width - EPS);
  const bt = Math.ceil(clamp(b.y + b.h, 0, 1) * height - EPS);
  return { x, y, w: Math.max(1, r - x), h: Math.max(1, bt - y) };
}

export interface Hittable {
  id: string;
  polygon: Polygon;
  bbox: BBox;
  z: number;
}

/**
 * Renvoie l'élément touché au point normalisé `p`.
 * Priorité : z le plus élevé, puis la plus petite aire (un objet posé sur une table gagne).
 */
export function hitTest<T extends Hittable>(elements: readonly T[], p: Vec2): T | null {
  const candidates = elements.filter((e) => bboxContains(e.bbox, p) && pointInPolygon(p, e.polygon));
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.z - a.z || polygonArea(a.polygon) - polygonArea(b.polygon));
  return candidates[0];
}

/** Placement « contain » d'une image dans un conteneur (letterboxing). */
export interface Fit {
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export function fitContain(containerW: number, containerH: number, imageW: number, imageH: number): Fit {
  const scale = Math.min(containerW / imageW, containerH / imageH);
  const width = imageW * scale;
  const height = imageH * scale;
  return { scale, width, height, offsetX: (containerW - width) / 2, offsetY: (containerH - height) / 2 };
}

/** Coordonnées écran (relatives au conteneur) -> normalisées ; null si hors de l'image. */
export function screenToNormalized(sx: number, sy: number, fit: Fit): Vec2 | null {
  const x = (sx - fit.offsetX) / fit.width;
  const y = (sy - fit.offsetY) / fit.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}
