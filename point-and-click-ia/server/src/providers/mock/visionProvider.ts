/**
 * VisionProvider MOCK : « voit » les formes connues du layout de l'image (aucune vraie analyse).
 * Avec une région, ne renvoie que les formes dont le centre est dans la région, comme le ferait
 * une segmentation lancée sur un recadrage.
 */
import { centerIn, type BBox, type DetectedElement, type ImageRef } from '@pnc/shared';
import type { VisionProvider } from '../ports';
import { shapePolygon } from './art';
import type { MockLayoutRegistry } from './imageProvider';

export class MockVisionProvider implements VisionProvider {
  constructor(private registry: MockLayoutRegistry) {}

  async segment(image: ImageRef, region?: BBox): Promise<DetectedElement[]> {
    const layout = this.registry.get(image.id);
    if (!layout) return [];
    return layout.shapes
      .filter((s) => !region || centerIn(region, s.bbox))
      .map((s) => ({
        name: s.name,
        description: s.description,
        polygon: shapePolygon(s),
        bbox: { ...s.bbox },
        z: s.z,
        tags: [...s.tags],
        sourceRef: s.ref,
        state: { ...s.state },
      }));
  }
}
