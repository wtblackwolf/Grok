/**
 * Roue d'actions radiale (≤ 6 options), pilotée par glissement :
 * on maintient, on glisse vers une option, on relâche pour la choisir ; relâcher au centre annule.
 * Près d'un bord, la roue est décalée pour rester visible : l'angle est alors mesuré depuis le centre
 * affiché, et la zone morte reste autour du point d'appui (voir radialPick).
 */
import { MAX_ACTIONS, clampWheelCenter, radialItemPosition, radialPick, type GameAction, type Vec2 } from '@pnc/shared';

export const DEAD_ZONE_PX = 28;

export class RadialWheel {
  private origin: Vec2 = { x: 0, y: 0 };
  private center: Vec2 = { x: 0, y: 0 };
  private items: GameAction[] = [];
  private highlighted: number | null = null;
  private isOpen = false;

  constructor(private root: HTMLElement) {}

  get open(): boolean {
    return this.isOpen;
  }

  private radius(): number {
    return Math.min(105, Math.max(72, Math.min(window.innerWidth, window.innerHeight) * 0.22));
  }

  show(at: Vec2, title: string): void {
    this.origin = at;
    this.items = [];
    this.highlighted = null;
    this.isOpen = true;
    const outer = this.radius() + 52;
    const c = clampWheelCenter(at, outer, window.innerWidth, window.innerHeight);
    this.center = c;
    this.root.style.left = `${c.x}px`;
    this.root.style.top = `${c.y}px`;
    this.root.innerHTML = `<div class="wheel-ring"></div><div class="wheel-center"><span>${escapeHtml(title)}</span><small>…</small></div>`;
    this.root.classList.remove('hidden');
    this.root.setAttribute('aria-hidden', 'false');
    navigator.vibrate?.(12);
  }

  setItems(actions: GameAction[]): void {
    if (!this.isOpen) return;
    this.items = actions.slice(0, MAX_ACTIONS);
    const r = this.radius();
    this.root.querySelector('.wheel-center small')!.textContent = this.items.length ? 'glissez puis relâchez' : 'rien à faire';
    this.root.querySelectorAll('.wheel-item').forEach((n) => n.remove());
    this.items.forEach((a, i) => {
      const p = radialItemPosition(i, this.items.length, r);
      const el = document.createElement('div');
      el.className = 'wheel-item';
      el.textContent = a.label;
      el.style.transform = `translate(calc(${p.x}px - 50%), calc(${p.y}px - 50%))`;
      el.dataset.index = String(i);
      this.root.appendChild(el);
    });
  }

  setError(message: string): void {
    const small = this.root.querySelector('.wheel-center small');
    if (small) small.textContent = message;
  }

  /** Met à jour la surbrillance selon la position du doigt / de la souris. */
  drag(at: Vec2): void {
    if (!this.isOpen) return;
    const idx = radialPick(at, this.origin, this.center, this.items.length, DEAD_ZONE_PX, this.radius());
    if (idx === this.highlighted) return;
    this.highlighted = idx;
    this.root.querySelectorAll<HTMLElement>('.wheel-item').forEach((n) => n.classList.toggle('active', n.dataset.index === String(idx)));
    if (idx !== null) navigator.vibrate?.(5);
  }

  /** Ferme la roue et renvoie l'action choisie (ou null = annulé). */
  release(at: Vec2): GameAction | null {
    this.drag(at);
    const chosen = this.highlighted !== null ? this.items[this.highlighted] ?? null : null;
    this.close();
    return chosen;
  }

  close(): void {
    this.isOpen = false;
    this.items = [];
    this.highlighted = null;
    this.root.classList.add('hidden');
    this.root.setAttribute('aria-hidden', 'true');
    this.root.innerHTML = '';
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
