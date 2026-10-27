/**
 * ImageProvider MOCK : dessine des scènes SVG à partir d'un MockLayout et simule l'inpainting
 * en modifiant la forme ciblée puis en ne rendant QUE la région demandée.
 */
import { toPixelRect } from '@pnc/shared';
import type { ImageRef } from '@pnc/shared';
import type { GenerateSceneRequest, ImageProvider, InpaintRequest, InpaintResult } from '../ports';
import type { ImageStore } from '../../engine/imageStore';
import { renderSvg, type MockLayout, type MockShape } from './art';

/** Registre partagé entre l'ImageProvider et le VisionProvider mock : image id -> layout. */
export class MockLayoutRegistry {
  private layouts = new Map<string, MockLayout>();
  set(imageId: string, layout: MockLayout) {
    this.layouts.set(imageId, layout);
  }
  get(imageId: string): MockLayout | undefined {
    return this.layouts.get(imageId);
  }
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export class MockImageProvider implements ImageProvider {
  private addSeq = 0;
  constructor(
    private store: ImageStore,
    private registry: MockLayoutRegistry,
  ) {}

  async generateScene(req: GenerateSceneRequest): Promise<ImageRef> {
    const layout = isLayout(req.spec) ? clone(req.spec) : fallbackLayout(req.prompt, req.width, req.height);
    const ref = this.store.put(renderSvg(layout), 'image/svg+xml', layout.width, layout.height, 'scene');
    this.registry.set(ref.id, layout);
    return ref;
  }

  async inpaint(req: InpaintRequest): Promise<InpaintResult> {
    const base = this.registry.get(req.image.id);
    if (!base) throw new Error(`MockImageProvider: image inconnue ${req.image.id}`);
    const layout = clone(base);
    const subj = req.subject;
    if (subj?.sourceRef) {
      if (subj.remove) {
        layout.shapes = layout.shapes.filter((s) => s.ref !== subj.sourceRef);
      } else {
        const shape = layout.shapes.find((s) => s.ref === subj.sourceRef);
        if (shape && subj.state) shape.state = { ...shape.state, ...subj.state };
      }
    }
    for (const a of subj?.add ?? []) {
      const shape: MockShape = { ref: `added-${++this.addSeq}`, z: 50, state: {}, ...a, kind: a.kind };
      layout.shapes.push(shape);
    }
    // Un vrai provider recevrait l'image + un masque (req.mask ?? rectangle de req.region) + req.prompt.
    const full = this.store.put(renderSvg(layout), 'image/svg+xml', layout.width, layout.height, 'scene');
    this.registry.set(full.id, layout);
    const px = toPixelRect(req.region, layout.width, layout.height);
    const patch = this.store.put(renderSvg(layout, req.region), 'image/svg+xml', px.w, px.h, 'patch');
    return { image: full, patch };
  }
}

function isLayout(v: unknown): v is MockLayout {
  return !!v && typeof v === 'object' && Array.isArray((v as MockLayout).shapes);
}

/** Scène minimale si aucune spec n'est fournie (ex. prompt libre). */
function fallbackLayout(prompt: string, width: number, height: number): MockLayout {
  return {
    width,
    height,
    palette: { wall: '#4b3b52', floor: '#3a3030', accent: '#c9a24a' },
    shapes: [
      { ref: 'wall', kind: 'wall', name: 'Mur', description: `Un mur. (${prompt.slice(0, 60)})`, tags: ['fond'], bbox: { x: 0, y: 0, w: 1, h: 0.62 }, z: 0, state: {} },
      { ref: 'floor', kind: 'floor', name: 'Sol', description: 'Le sol.', tags: ['fond', 'sol'], bbox: { x: 0, y: 0.62, w: 1, h: 0.38 }, z: 0, state: {} },
    ],
  };
}

