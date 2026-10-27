/**
 * Rendu de la scène sur <canvas> :
 *  - l'image du lieu est composée dans un canvas SOURCE à sa résolution native ;
 *  - un patch ne redessine QUE son rectangle dans ce canvas source (compositing partiel) ;
 *  - le canvas affiché est mis à l'échelle « contain » (responsive, devicePixelRatio) ;
 *  - le hit-testing se fait en coordonnées normalisées sur les polygones des éléments.
 */
import { fitContain, hitTest, screenToNormalized, type ElementView, type Fit, type ImagePatch, type LocationView } from '@pnc/shared';

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image introuvable : ${url}`));
    img.src = url;
  });
}

interface Flash {
  rect: { x: number; y: number; w: number; h: number };
  until: number;
}

export class SceneRenderer {
  private ctx: CanvasRenderingContext2D;
  private source = document.createElement('canvas');
  private sctx = this.source.getContext('2d')!;
  private fit: Fit = { scale: 1, offsetX: 0, offsetY: 0, width: 1, height: 1 };
  private elements: ElementView[] = [];
  private selectedId: string | null = null;
  private flash: Flash | null = null;
  showOutlines = false;
  /** Id de l'image complète actuellement composée (après patchs). */
  currentImageId = '';

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement ?? canvas);
    this.resize();
  }

  /** Charge l'image complète d'un lieu. */
  async showLocation(location: LocationView): Promise<void> {
    const img = await loadImage(location.image.url);
    this.source.width = location.image.width;
    this.source.height = location.image.height;
    this.sctx.drawImage(img, 0, 0, this.source.width, this.source.height);
    this.currentImageId = location.image.id;
    this.setElements(location.elements);
  }

  /** Restaure un lieu depuis un instantané local (sans aucun téléchargement). */
  restore(snapshot: HTMLCanvasElement, imageId: string, elements: ElementView[]): void {
    this.source.width = snapshot.width;
    this.source.height = snapshot.height;
    this.sctx.drawImage(snapshot, 0, 0);
    this.currentImageId = imageId;
    this.setElements(elements);
  }

  /** Applique une mise à jour partielle : seule la région est recomposée. */
  async applyPatch(patch: ImagePatch): Promise<void> {
    const img = await loadImage(patch.image.url);
    const r = patch.pixelRect;
    this.sctx.clearRect(r.x, r.y, r.w, r.h);
    this.sctx.drawImage(img, r.x, r.y, r.w, r.h);
    this.currentImageId = patch.fullImage.id;
    this.flash = { rect: r, until: performance.now() + 900 };
    this.animate();
  }

  snapshot(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.source.width;
    c.height = this.source.height;
    c.getContext('2d')!.drawImage(this.source, 0, 0);
    return c;
  }

  setElements(elements: ElementView[]): void {
    this.elements = elements;
    if (this.selectedId && !elements.some((e) => e.id === this.selectedId)) this.selectedId = null;
    this.render();
  }

  getElement(id: string): ElementView | undefined {
    return this.elements.find((e) => e.id === id);
  }

  select(id: string | null): void {
    this.selectedId = id;
    this.render();
  }

  /** Élément sous un point écran (clientX/clientY), ou null. */
  pick(clientX: number, clientY: number): ElementView | null {
    const rect = this.canvas.getBoundingClientRect();
    const p = screenToNormalized(clientX - rect.left, clientY - rect.top, this.fit);
    return p ? hitTest(this.elements, p) : null;
  }

  private resize(): void {
    const parent = this.canvas.parentElement ?? this.canvas;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  private animate = () => {
    this.render();
    if (this.flash && performance.now() < this.flash.until) requestAnimationFrame(this.animate);
    else if (this.flash) {
      this.flash = null;
      this.render();
    }
  };

  render(): void {
    const parent = this.canvas.parentElement ?? this.canvas;
    const cw = parent.clientWidth;
    const ch = parent.clientHeight;
    this.ctx.clearRect(0, 0, cw, ch);
    if (!this.source.width) return;
    this.fit = fitContain(cw, ch, this.source.width, this.source.height);
    const f = this.fit;
    this.ctx.imageSmoothingQuality = 'high';
    this.ctx.drawImage(this.source, f.offsetX, f.offsetY, f.width, f.height);

    const toScreen = (x: number, y: number): [number, number] => [f.offsetX + x * f.width, f.offsetY + y * f.height];
    const tracePoly = (el: ElementView) => {
      this.ctx.beginPath();
      el.polygon.forEach((p, i) => (i ? this.ctx.lineTo(...toScreen(p.x, p.y)) : this.ctx.moveTo(...toScreen(p.x, p.y))));
      this.ctx.closePath();
    };

    if (this.showOutlines) {
      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = 'rgba(120, 220, 255, 0.7)';
      for (const el of this.elements) {
        tracePoly(el);
        this.ctx.stroke();
      }
    }
    const sel = this.selectedId ? this.getElement(this.selectedId) : undefined;
    if (sel) {
      tracePoly(sel);
      this.ctx.fillStyle = 'rgba(255, 220, 120, 0.15)';
      this.ctx.fill();
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = 'rgba(255, 220, 120, 0.95)';
      this.ctx.stroke();
    }
    if (this.flash) {
      // Visualise la zone repeinte (seule cette région a changé).
      const k = Math.max(0, (this.flash.until - performance.now()) / 900);
      const r = this.flash.rect;
      const sx = this.fit.width / this.source.width;
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([6, 4]);
      this.ctx.strokeStyle = `rgba(140, 255, 170, ${k})`;
      this.ctx.strokeRect(f.offsetX + r.x * sx, f.offsetY + r.y * sx, r.w * sx, r.h * sx);
      this.ctx.setLineDash([]);
    }
  }
}
