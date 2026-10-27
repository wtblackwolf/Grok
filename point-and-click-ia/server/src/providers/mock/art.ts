/**
 * Dessin procédural des scènes MOCK en SVG.
 *
 * Une scène mock est une liste de formes (MockShape) décrites en coordonnées normalisées.
 * Le même rendu sert à l'image complète et aux patchs de région (on change juste la viewBox),
 * ce qui garantit qu'un patch se raccorde parfaitement à l'image existante.
 */
import { ellipsePolygon, rectPolygon, toPixelRect, hashString } from '@pnc/shared';
import type { BBox, ElementState, Polygon } from '@pnc/shared';

export type ShapeKind =
  | 'wall' | 'floor' | 'sky' | 'ground' | 'window' | 'door' | 'archway' | 'table' | 'lamp'
  | 'chest' | 'key' | 'item' | 'character' | 'barrel' | 'crate' | 'tree' | 'fountain' | 'bench'
  | 'painting' | 'fireplace' | 'shelf' | 'lantern' | 'sign' | 'stairs' | 'moon';

export interface MockShape {
  /** Référence stable (devient `sourceRef` côté moteur). */
  ref: string;
  kind: ShapeKind | string;
  name: string;
  description: string;
  tags: string[];
  bbox: BBox;
  z: number;
  state: ElementState;
  color?: string;
}

export interface MockLayout {
  width: number;
  height: number;
  palette: { wall: string; floor: string; accent: string };
  shapes: MockShape[];
}

export function shapePolygon(s: MockShape): Polygon {
  const b = s.bbox;
  switch (s.kind) {
    case 'tree':
    case 'fountain':
    case 'moon':
      return ellipsePolygon(b, 20);
    case 'character': {
      // silhouette : tête étroite + épaules + corps
      const cx = b.x + b.w / 2;
      return [
        { x: cx - b.w * 0.18, y: b.y },
        { x: cx + b.w * 0.18, y: b.y },
        { x: cx + b.w * 0.22, y: b.y + b.h * 0.22 },
        { x: b.x + b.w, y: b.y + b.h * 0.32 },
        { x: b.x + b.w * 0.9, y: b.y + b.h },
        { x: b.x + b.w * 0.1, y: b.y + b.h },
        { x: b.x, y: b.y + b.h * 0.32 },
        { x: cx - b.w * 0.22, y: b.y + b.h * 0.22 },
      ];
    }
    default:
      return rectPolygon(b);
  }
}

const isTrue = (v: unknown) => v === true || v === 'true' || v === 'oui';

function moodMouth(mood: string): 'smile' | 'frown' | 'flat' {
  const m = mood.toLowerCase();
  if (/(ravi|joyeu|content|amus|heureu|chaleur)/.test(m)) return 'smile';
  if (/(fâch|fach|irrit|méfi|mefi|colère|inquiet|effray)/.test(m)) return 'frown';
  return 'flat';
}

/** Rendu SVG d'une forme, en pixels. */
function drawShape(s: MockShape, W: number, H: number, layout: MockLayout): string {
  const x = s.bbox.x * W;
  const y = s.bbox.y * H;
  const w = s.bbox.w * W;
  const h = s.bbox.h * H;
  const st = s.state;
  const c = s.color;
  const seed = hashString(s.ref);
  switch (s.kind) {
    case 'wall': {
      let lines = '';
      for (let i = 1; i < 8; i++) lines += `<line x1="${x}" y1="${y + (h * i) / 8}" x2="${x + w}" y2="${y + (h * i) / 8}" stroke="#0002" stroke-width="2"/>`;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c ?? layout.palette.wall}"/>${lines}`;
    }
    case 'floor': {
      let lines = '';
      for (let i = 0; i <= 10; i++) {
        const fx = x + (w * i) / 10;
        lines += `<line x1="${x + w / 2 + (fx - x - w / 2) * 0.55}" y1="${y}" x2="${fx}" y2="${y + h}" stroke="#0003" stroke-width="2"/>`;
      }
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c ?? layout.palette.floor}"/>${lines}`;
    }
    case 'sky': {
      let stars = '';
      for (let i = 0; i < 24; i++) {
        const sx = x + ((seed * (i + 3) * 7919) % 1000) / 1000 * w;
        const sy = y + ((seed * (i + 7) * 104729) % 1000) / 1000 * h * 0.9;
        stars += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="1.6" fill="#fff9"/>`;
      }
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c ?? '#1b2440'}"/>${stars}`;
    }
    case 'ground': {
      let stones = '';
      for (let i = 0; i < 40; i++) {
        const sx = x + (((seed + i * 2654435761) >>> 0) % 1000) / 1000 * w;
        const sy = y + (((seed + i * 40503) * 31) % 1000) / 1000 * h;
        stones += `<ellipse cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" rx="14" ry="6" fill="#0002"/>`;
      }
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c ?? '#6b6458'}"/>${stones}`;
    }
    case 'window': {
      const broken = isTrue(st.brisé);
      const glass = broken ? '#2a3550' : isTrue(st.ouvert) ? '#0d1424' : '#8fb3d9';
      const cracks = broken
        ? `<path d="M${x + w * 0.5} ${y + h * 0.45} L${x + w * 0.15} ${y + h * 0.15} M${x + w * 0.5} ${y + h * 0.45} L${x + w * 0.85} ${y + h * 0.2} M${x + w * 0.5} ${y + h * 0.45} L${x + w * 0.7} ${y + h * 0.9} M${x + w * 0.5} ${y + h * 0.45} L${x + w * 0.2} ${y + h * 0.8}" stroke="#dde" stroke-width="3"/>`
        : '';
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#5a3a22"/><rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}" fill="${glass}"/>` +
        (broken ? '' : `<line x1="${x + w / 2}" y1="${y + 8}" x2="${x + w / 2}" y2="${y + h - 8}" stroke="#5a3a22" stroke-width="6"/><line x1="${x + 8}" y1="${y + h / 2}" x2="${x + w - 8}" y2="${y + h / 2}" stroke="#5a3a22" stroke-width="6"/>`) +
        cracks;
    }
    case 'door': {
      const frame = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#3b2414"/>`;
      if (isTrue(st.ouvert)) {
        return `${frame}<rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 8}" fill="#0b0a10"/>` +
          `<polygon points="${x + 8},${y + 8} ${x + w * 0.38},${y + 30} ${x + w * 0.38},${y + h - 20} ${x + 8},${y + h}" fill="${c ?? '#7a4b2a'}"/>` +
          `<rect x="${x + w * 0.45}" y="${y + h * 0.55}" width="${w * 0.4}" height="${h * 0.45}" fill="#e8c86a22"/>`;
      }
      let planks = '';
      for (let i = 1; i < 4; i++) planks += `<line x1="${x + 8 + ((w - 16) * i) / 4}" y1="${y + 8}" x2="${x + 8 + ((w - 16) * i) / 4}" y2="${y + h}" stroke="#0004" stroke-width="3"/>`;
      return `${frame}<rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 8}" fill="${c ?? '#7a4b2a'}"/>${planks}<circle cx="${x + w * 0.8}" cy="${y + h * 0.55}" r="${Math.max(4, w * 0.05)}" fill="#d4af37"/>`;
    }
    case 'archway':
      return `<path d="M${x} ${y + h} L${x} ${y + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2} L${x + w} ${y + h} Z" fill="${c ?? '#121018'}" stroke="#4a4038" stroke-width="10"/>`;
    case 'table':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h * 0.22}" rx="6" fill="${c ?? '#8a5a33'}"/>` +
        `<rect x="${x + w * 0.06}" y="${y + h * 0.22}" width="${w * 0.06}" height="${h * 0.78}" fill="#5c3a1f"/>` +
        `<rect x="${x + w * 0.88}" y="${y + h * 0.22}" width="${w * 0.06}" height="${h * 0.78}" fill="#5c3a1f"/>`;
    case 'lamp':
    case 'lantern': {
      const lit = isTrue(st.allumé);
      const cx = x + w / 2;
      const post = s.kind === 'lantern'
        ? `<rect x="${cx - w * 0.08}" y="${y + h * 0.3}" width="${w * 0.16}" height="${h * 0.7}" fill="#222"/>`
        : `<rect x="${x + w * 0.2}" y="${y + h * 0.8}" width="${w * 0.6}" height="${h * 0.2}" rx="4" fill="#6b4d2a"/>`;
      const headY = s.kind === 'lantern' ? y + h * 0.05 : y + h * 0.25;
      const headH = s.kind === 'lantern' ? h * 0.27 : h * 0.55;
      const glow = lit
        ? `<ellipse cx="${cx}" cy="${headY + headH / 2}" rx="${w * 0.5}" ry="${Math.min(h * 0.5, headH)}" fill="#ffd76a" opacity="0.45"/>`
        : '';
      return `${glow}${post}<rect x="${x + w * 0.25}" y="${headY}" width="${w * 0.5}" height="${headH}" rx="8" fill="${lit ? '#ffe9a0' : '#9aa3a8'}" stroke="#333" stroke-width="3"/>` +
        (lit ? `<path d="M${cx} ${headY + headH * 0.75} q-8 -14 0 -28 q8 14 0 28" fill="#ff9a2a"/>` : '');
    }
    case 'chest': {
      const open = isTrue(st.ouvert);
      const body = `<rect x="${x}" y="${y + h * 0.35}" width="${w}" height="${h * 0.65}" rx="6" fill="${c ?? '#7b4a1e'}" stroke="#3b2210" stroke-width="4"/><rect x="${x + w * 0.45}" y="${y + h * 0.42}" width="${w * 0.1}" height="${h * 0.16}" fill="#d4af37"/>`;
      return open
        ? `<rect x="${x}" y="${y}" width="${w}" height="${h * 0.32}" rx="6" fill="#5e3814" stroke="#3b2210" stroke-width="4"/><rect x="${x + 6}" y="${y + h * 0.32}" width="${w - 12}" height="${h * 0.12}" fill="#160d06"/>${body}`
        : `<path d="M${x} ${y + h * 0.38} Q${x + w / 2} ${y + h * 0.05} ${x + w} ${y + h * 0.38} Z" fill="#5e3814" stroke="#3b2210" stroke-width="4"/>${body}`;
    }
    case 'key':
      return `<circle cx="${x + w * 0.25}" cy="${y + h / 2}" r="${h * 0.32}" fill="none" stroke="${c ?? '#b08d3a'}" stroke-width="${Math.max(3, h * 0.14)}"/><rect x="${x + w * 0.45}" y="${y + h * 0.42}" width="${w * 0.5}" height="${h * 0.16}" fill="${c ?? '#b08d3a'}"/><rect x="${x + w * 0.8}" y="${y + h * 0.5}" width="${w * 0.08}" height="${h * 0.3}" fill="${c ?? '#b08d3a'}"/>`;
    case 'item':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) / 3}" fill="${c ?? '#c9a24a'}" stroke="#333" stroke-width="2"/>`;
    case 'character': {
      const cx = x + w / 2;
      const headR = Math.min(w * 0.2, h * 0.11);
      const headCy = y + headR + 2;
      const mouth = moodMouth(String(st.humeur ?? ''));
      const my = headCy + headR * 0.45;
      const mouthPath =
        mouth === 'smile' ? `M${cx - headR * 0.4} ${my} Q${cx} ${my + headR * 0.35} ${cx + headR * 0.4} ${my}`
        : mouth === 'frown' ? `M${cx - headR * 0.4} ${my + headR * 0.2} Q${cx} ${my - headR * 0.2} ${cx + headR * 0.4} ${my + headR * 0.2}`
        : `M${cx - headR * 0.4} ${my} L${cx + headR * 0.4} ${my}`;
      return `<path d="M${x} ${y + h} L${x + w * 0.1} ${y + h * 0.32} Q${cx} ${y + h * 0.2} ${x + w * 0.9} ${y + h * 0.32} L${x + w} ${y + h} Z" fill="${c ?? '#7d2e3a'}"/>` +
        `<rect x="${x + w * 0.2}" y="${y + h * 0.55}" width="${w * 0.6}" height="${h * 0.08}" fill="#0003"/>` +
        `<circle cx="${cx}" cy="${headCy}" r="${headR}" fill="#e8c4a0"/>` +
        `<circle cx="${cx - headR * 0.35}" cy="${headCy - headR * 0.1}" r="${headR * 0.1}" fill="#222"/><circle cx="${cx + headR * 0.35}" cy="${headCy - headR * 0.1}" r="${headR * 0.1}" fill="#222"/>` +
        `<path d="${mouthPath}" stroke="#622" stroke-width="2.5" fill="none"/>`;
    }
    case 'barrel':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.2}" fill="${c ?? '#86552c'}"/><rect x="${x}" y="${y + h * 0.2}" width="${w}" height="${h * 0.06}" fill="#333"/><rect x="${x}" y="${y + h * 0.74}" width="${w}" height="${h * 0.06}" fill="#333"/>`;
    case 'crate':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c ?? '#a07a45'}" stroke="#5a4020" stroke-width="5"/><path d="M${x} ${y} L${x + w} ${y + h} M${x + w} ${y} L${x} ${y + h}" stroke="#5a4020" stroke-width="5"/>`;
    case 'tree':
      return `<rect x="${x + w * 0.42}" y="${y + h * 0.5}" width="${w * 0.16}" height="${h * 0.5}" fill="#4a3220"/><ellipse cx="${x + w / 2}" cy="${y + h * 0.35}" rx="${w / 2}" ry="${h * 0.35}" fill="${c ?? '#2f5d34'}"/>`;
    case 'fountain':
      return `<ellipse cx="${x + w / 2}" cy="${y + h * 0.6}" rx="${w / 2}" ry="${h * 0.4}" fill="#8b8d90"/><ellipse cx="${x + w / 2}" cy="${y + h * 0.58}" rx="${w * 0.42}" ry="${h * 0.3}" fill="${isTrue(st.trouble) ? '#5d6b3a' : '#4f86b8'}"/><rect x="${x + w * 0.46}" y="${y}" width="${w * 0.08}" height="${h * 0.5}" fill="#8b8d90"/>`;
    case 'bench':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h * 0.3}" fill="${c ?? '#7a5a3a'}"/><rect x="${x + w * 0.05}" y="${y + h * 0.3}" width="${w * 0.07}" height="${h * 0.7}" fill="#4a3424"/><rect x="${x + w * 0.88}" y="${y + h * 0.3}" width="${w * 0.07}" height="${h * 0.7}" fill="#4a3424"/>`;
    case 'painting':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#b8902f"/><rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}" fill="${isTrue(st.décroché) ? '#3a2a1a' : '#4d6f8a'}"/>` +
        (isTrue(st.décroché) ? '' : `<path d="M${x + 8} ${y + h - 8} L${x + w * 0.4} ${y + h * 0.45} L${x + w * 0.6} ${y + h * 0.7} L${x + w - 8} ${y + h * 0.35} L${x + w - 8} ${y + h - 8} Z" fill="#3c5a3a"/>`);
    case 'fireplace': {
      const lit = isTrue(st.allumé);
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#77706a"/><rect x="${x + w * 0.15}" y="${y + h * 0.35}" width="${w * 0.7}" height="${h * 0.65}" fill="#1a1412"/>` +
        (lit ? `<path d="M${x + w * 0.3} ${y + h} Q${x + w * 0.35} ${y + h * 0.55} ${x + w * 0.5} ${y + h * 0.45} Q${x + w * 0.65} ${y + h * 0.6} ${x + w * 0.7} ${y + h} Z" fill="#ff8a1e"/><ellipse cx="${x + w / 2}" cy="${y + h * 0.8}" rx="${w * 0.3}" ry="${h * 0.15}" fill="#ffd36a" opacity="0.6"/>` : `<rect x="${x + w * 0.3}" y="${y + h * 0.9}" width="${w * 0.4}" height="${h * 0.06}" fill="#3a2a20"/>`);
    }
    case 'shelf': {
      let s2 = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#5c3d22"/>`;
      for (let i = 0; i < 3; i++) {
        const sy = y + (h * (i + 1)) / 3;
        s2 += `<rect x="${x}" y="${sy - 6}" width="${w}" height="6" fill="#3a2614"/>`;
        for (let j = 0; j < 5; j++) s2 += `<rect x="${x + 8 + j * (w - 16) / 5}" y="${sy - 6 - h * 0.18}" width="${(w - 16) / 8}" height="${h * 0.18}" rx="3" fill="${['#2e6b3a', '#6b2e3a', '#2e3a6b'][(i + j + seed) % 3]}"/>`;
      }
      return s2;
    }
    case 'sign':
      return `<rect x="${x + w * 0.45}" y="${y + h * 0.4}" width="${w * 0.1}" height="${h * 0.6}" fill="#3b2a1a"/><rect x="${x}" y="${y}" width="${w}" height="${h * 0.45}" rx="6" fill="${c ?? '#a0763c'}" stroke="#3b2a1a" stroke-width="4"/>`;
    case 'stairs': {
      let steps = '';
      for (let i = 0; i < 6; i++) steps += `<rect x="${x + (w * i) / 12}" y="${y + (h * i) / 6}" width="${w - (w * i) / 6}" height="${h / 6}" fill="${i % 2 ? '#6d655c' : '#7d756c'}"/>`;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#141218"/>${steps}`;
    }
    case 'moon':
      return `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.min(w, h) / 2}" fill="#f2edd0"/>`;
    default:
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c ?? '#999'}" stroke="#333" stroke-width="2"/>`;
  }
}

/** SVG complet ou limité à une région (patch). */
export function renderSvg(layout: MockLayout, region?: BBox): string {
  const W = layout.width;
  const H = layout.height;
  const px = region ? toPixelRect(region, W, H) : { x: 0, y: 0, w: W, h: H };
  const body = [...layout.shapes]
    .sort((a, b) => a.z - b.z)
    .map((s) => drawShape(s, W, H, layout))
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px.w}" height="${px.h}" viewBox="${px.x} ${px.y} ${px.w} ${px.h}" preserveAspectRatio="none">` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#000"/>${body}</svg>`
  );
}
