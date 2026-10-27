/**
 * Fusion des éléments après ré-analyse partielle d'une région de l'image.
 * Seuls les éléments dont le CENTRE est dans la région sont remplacés : le reste de la scène
 * (et ses ids, états, liens personnage/sortie) est conservé tel quel.
 */
import { bboxCenter, bboxContains } from './geometry';
import type { BBox, ElementState, Polygon, SceneElement } from './types';

/** Élément tel que renvoyé par un VisionProvider. */
export interface DetectedElement {
  name: string;
  description: string;
  polygon: Polygon;
  bbox: BBox;
  z: number;
  tags: string[];
  sourceRef?: string;
  /** Indices d'état observables ou fournis par le générateur (porte ouverte, lampe allumée…). */
  state?: ElementState;
}

export function centerIn(region: BBox, bbox: BBox): boolean {
  return bboxContains(region, bboxCenter(bbox));
}

export function mergeRegionElements(
  existing: readonly SceneElement[],
  detected: readonly DetectedElement[],
  region: BBox,
  newId: () => string,
): SceneElement[] {
  const outside = existing.filter((e) => !centerIn(region, e.bbox));
  const inside = existing.filter((e) => centerIn(region, e.bbox));
  const used = new Set<string>();
  const merged: SceneElement[] = [];

  for (const d of detected) {
    if (!centerIn(region, d.bbox)) continue; // le provider ne doit pas toucher hors région
    const match =
      inside.find((e) => !used.has(e.id) && d.sourceRef && e.sourceRef === d.sourceRef) ??
      inside.find((e) => !used.has(e.id) && e.name.toLowerCase() === d.name.toLowerCase());
    if (match) {
      used.add(match.id);
      merged.push({
        ...match,
        polygon: d.polygon,
        bbox: d.bbox,
        z: d.z,
        tags: [...new Set([...match.tags, ...d.tags])],
        sourceRef: d.sourceRef ?? match.sourceRef,
      });
    } else {
      merged.push({ ...d, id: newId(), state: { ...(d.state ?? {}) } });
    }
  }
  return [...outside, ...merged];
}
