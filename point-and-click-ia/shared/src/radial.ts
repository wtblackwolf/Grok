/**
 * Mathématiques de la roue radiale (sans DOM, donc testables).
 * Les options sont réparties dans le sens horaire en partant du haut (12 h).
 */
import type { Vec2 } from './types';

const TAU = Math.PI * 2;

/** Angle (radians, horaire depuis le haut) du centre de l'option `i` sur `count`. */
export function radialItemAngle(i: number, count: number): number {
  return (i / count) * TAU;
}

/** Position (pixels, y vers le bas) du centre de l'option `i` à `radius` du centre. */
export function radialItemPosition(i: number, count: number, radius: number): Vec2 {
  const a = radialItemAngle(i, count);
  return { x: Math.sin(a) * radius, y: -Math.cos(a) * radius };
}

/**
 * Index de l'option visée par un glissement (dx, dy) depuis le centre, ou null :
 *  - si aucun item ;
 *  - si le pointeur est dans la zone morte centrale (relâcher au centre = annuler).
 */
export function radialIndexAt(dx: number, dy: number, count: number, deadZone: number): number | null {
  if (count <= 0) return null;
  if (Math.hypot(dx, dy) < deadZone) return null;
  let a = Math.atan2(dx, -dy); // 0 en haut, positif dans le sens horaire (écran : y vers le bas)
  if (a < 0) a += TAU;
  const sector = TAU / count;
  return Math.floor(((a + sector / 2) % TAU) / sector) % count;
}

/**
 * Décale le centre de la roue pour qu'elle reste entièrement visible.
 * `outer` = rayon des items + demi-taille d'un item.
 */
export function clampWheelCenter(center: Vec2, outer: number, viewW: number, viewH: number): Vec2 {
  const x = Math.min(Math.max(center.x, outer), Math.max(outer, viewW - outer));
  const y = Math.min(Math.max(center.y, outer), Math.max(outer, viewH - outer));
  return { x, y };
}

/**
 * Sélection quand la roue a été décalée pour rester à l'écran (centre affiché ≠ point d'appui) :
 *  - un pointeur posé sur un item affiché (à moins de `itemHitRadius` de son centre) le sélectionne ;
 *  - sinon, relâcher près du point d'appui (zone morte) annule, comme au centre ;
 *  - sinon l'angle est mesuré depuis le centre AFFICHÉ, pour correspondre à ce que voit le joueur.
 * Si centre et point d'appui coïncident, équivaut à radialIndexAt (+ le test « sur l'item »).
 */
export function radialPick(
  pointer: Vec2,
  origin: Vec2,
  center: Vec2,
  count: number,
  deadZone: number,
  radius?: number,
  itemHitRadius = deadZone * 1.4,
): number | null {
  if (count <= 0) return null;
  if (radius !== undefined) {
    let best: number | null = null;
    let bestD = itemHitRadius;
    for (let i = 0; i < count; i++) {
      const p = radialItemPosition(i, count, radius);
      const d = Math.hypot(pointer.x - (center.x + p.x), pointer.y - (center.y + p.y));
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best !== null) return best;
  }
  if (Math.hypot(pointer.x - origin.x, pointer.y - origin.y) < deadZone) return null;
  return radialIndexAt(pointer.x - center.x, pointer.y - center.y, count, deadZone / 2);
}
