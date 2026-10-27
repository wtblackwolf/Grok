/**
 * Stockage en mémoire des images servies par `GET /api/image/:id`.
 * Les vrais providers y déposeront des PNG/JPEG ; le mock y dépose des SVG.
 */
import type { ImageRef } from '@pnc/shared';

export interface StoredImage {
  mime: string;
  body: string | Buffer;
}

export class ImageStore {
  private images = new Map<string, StoredImage>();
  private seq = 0;

  put(body: string | Buffer, mime: string, width: number, height: number, prefix = 'img'): ImageRef {
    const id = `${prefix}-${++this.seq}-${Date.now().toString(36)}`;
    this.images.set(id, { mime, body });
    return { id, url: `/api/image/${id}`, width, height };
  }

  get(id: string): StoredImage | undefined {
    return this.images.get(id);
  }

  get size(): number {
    return this.images.size;
  }
}
