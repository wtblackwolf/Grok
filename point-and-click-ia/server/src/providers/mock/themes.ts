/**
 * Décors MOCK : une taverne de départ et des lieux « suivants » génériques.
 * Chaque thème produit un MockLayout (pour l'image mock) + les métadonnées du lieu.
 * Le lieu précédent est TOUJOURS relié par l'élément de ref 'back'.
 */
import type { BBox, ElementState } from '@pnc/shared';
import type { CharacterDraft } from '../ports';
import type { MockLayout, MockShape } from './art';

export const SCENE_W = 1280;
export const SCENE_H = 720;

const s = (
  ref: string,
  kind: string,
  name: string,
  description: string,
  tags: string[],
  bbox: BBox,
  z: number,
  state: ElementState = {},
  color?: string,
): MockShape => ({ ref, kind, name, description, tags, bbox, z, state, color });

export interface ThemeOutput {
  name: string;
  description: string;
  scenePrompt: string;
  layout: MockLayout;
  characters: CharacterDraft[];
}

export function tavernTheme(): ThemeOutput {
  const shapes: MockShape[] = [
    s('wall', 'wall', 'Mur de la taverne', 'Un mur de planches noircies par des années de fumée.', ['fond', 'mur'], { x: 0, y: 0, w: 1, h: 0.62 }, 0),
    s('floor', 'floor', 'Plancher', 'Un plancher grinçant, collant de bière renversée.', ['fond', 'sol'], { x: 0, y: 0.62, w: 1, h: 0.38 }, 0),
    s('window', 'window', 'Fenêtre', 'Une petite fenêtre à croisillons donnant sur la nuit.', ['fenêtre', 'fragile', 'ouvrable'], { x: 0.06, y: 0.1, w: 0.16, h: 0.22 }, 2, { ouvert: false }),
    s('painting', 'painting', "Tableau d'un paysage", 'Une croûte représentant des collines vertes. Il est un peu de travers.', ['décor', 'décrochable'], { x: 0.32, y: 0.1, w: 0.14, h: 0.16 }, 2),
    s('fireplace', 'fireplace', 'Cheminée', "Une cheminée de pierre, l'âtre est froid.", ['cheminée', 'feu', 'lumière'], { x: 0.55, y: 0.28, w: 0.18, h: 0.34 }, 2, { allumé: false }),
    s('door-main', 'door', 'Porte de la taverne', 'Une lourde porte de chêne cloutée qui donne sur la rue.', ['porte', 'sortie', 'ouvrable'], { x: 0.8, y: 0.16, w: 0.13, h: 0.5 }, 2, { ouvert: false }),
    s('barrel', 'barrel', 'Tonneau de bière', 'Un tonneau cerclé de fer, au robinet qui goutte.', ['tonneau', 'meuble', 'boisson'], { x: 0.01, y: 0.56, w: 0.08, h: 0.18 }, 3),
    s('table', 'table', 'Table en bois', 'Une table massive marquée de coups de couteau.', ['meuble', 'table'], { x: 0.27, y: 0.57, w: 0.27, h: 0.18 }, 3),
    s('lamp', 'lamp', 'Lampe à huile', "Une lampe à huile éteinte posée sur la table.", ['lumière', 'portable', 'objet'], { x: 0.385, y: 0.44, w: 0.05, h: 0.13 }, 4, { allumé: false }),
    s('chest', 'chest', 'Coffre', 'Un vieux coffre aux ferrures rouillées.', ['contenant', 'ouvrable', 'meuble'], { x: 0.6, y: 0.7, w: 0.12, h: 0.15 }, 4, { ouvert: false, contient: 'Clé rouillée' }),
    s('marthe', 'character', 'Marthe, l’aubergiste', 'Une femme robuste au tablier taché, qui essuie un gobelet.', ['personnage'], { x: 0.12, y: 0.34, w: 0.1, h: 0.44 }, 5, { humeur: 'bourrue' }, '#7d2e3a'),
  ];
  return {
    name: 'Taverne du Corbeau',
    description: "Une taverne enfumée au bord d'une ville portuaire. Il est tard ; le feu est mort.",
    scenePrompt:
      "Intérieur d'une taverne médiévale de nuit, plancher de bois, cheminée éteinte, table avec une lampe à huile, coffre, tonneau, une aubergiste, porte cloutée à droite. Point-and-click, peint à la main.",
    layout: { width: SCENE_W, height: SCENE_H, palette: { wall: '#5b3f2c', floor: '#3e2a1d', accent: '#c9a24a' }, shapes },
    characters: [
      {
        name: 'Marthe',
        background:
          "Aubergiste de la Taverne du Corbeau depuis vingt ans. Veuve d'un marin, elle connaît tous les ragots du port et garde un vieux coffre qu'elle n'ouvre jamais.",
        personality: 'bourrue mais chaleureuse, méfiante envers les inconnus, aime les gens polis',
        mood: 'bourrue',
        elementHint: 'marthe',
      },
    ],
  };
}

type NextTheme = (prevName: string, variant: number) => ThemeOutput;

const suffix = (variant: number) => (variant > 0 ? ` (${['', 'est', 'nord', 'ouest', 'sud'][variant % 5] || variant})` : '');

const alley: NextTheme = (prev, v) => ({
  name: `Ruelle des Lanternes${suffix(v)}`,
  description: `Une ruelle pavée juste derrière ${prev}. Une lanterne grésille, la brume monte du port.`,
  scenePrompt: `Ruelle pavée de nuit, façades, lanterne de rue, caisses, enseigne, un veilleur, porte vers ${prev} à gauche, passage voûté à droite.`,
  layout: {
    width: SCENE_W,
    height: SCENE_H,
    palette: { wall: '#4a4552', floor: '#5b5650', accent: '#e0b64a' },
    shapes: [
      s('sky', 'sky', 'Ciel nocturne', 'Un ciel sans nuages, piqué d’étoiles.', ['fond', 'ciel'], { x: 0, y: 0, w: 1, h: 0.2 }, 0),
      s('moon', 'moon', 'Lune', 'Une lune presque pleine.', ['ciel', 'lointain'], { x: 0.6, y: 0.02, w: 0.06, h: 0.11 }, 1),
      s('facades', 'wall', 'Façades', 'Des façades à colombages serrées les unes contre les autres.', ['fond', 'mur'], { x: 0, y: 0.2, w: 1, h: 0.4 }, 0, {}, '#4a4552'),
      s('ground', 'ground', 'Pavés', 'Des pavés glissants d’humidité.', ['fond', 'sol'], { x: 0, y: 0.6, w: 1, h: 0.4 }, 0),
      s('back', 'door', `Porte de ${prev}`, `La porte par laquelle on sort de ${prev}.`, ['porte', 'sortie', 'ouvrable'], { x: 0.1, y: 0.22, w: 0.12, h: 0.4 }, 2, { ouvert: true }),
      s('sign', 'sign', 'Enseigne', 'Une enseigne de bois où un corbeau est grossièrement peint.', ['décor', 'enseigne'], { x: 0.24, y: 0.22, w: 0.1, h: 0.2 }, 2),
      s('lantern', 'lantern', 'Lanterne de rue', 'Une lanterne sur un poteau de fer.', ['lumière'], { x: 0.4, y: 0.12, w: 0.06, h: 0.5 }, 2, { allumé: true }),
      s('crate', 'crate', 'Caisse', 'Une caisse de marchandises abandonnée.', ['meuble', 'fouillable'], { x: 0.6, y: 0.6, w: 0.1, h: 0.16 }, 3, { contient: 'Pièce de cuivre' }),
      s('onward', 'archway', 'Passage voûté vers le port', 'Un passage sombre qui descend vers les quais.', ['passage', 'sortie'], { x: 0.8, y: 0.24, w: 0.14, h: 0.38 }, 2),
      s('edmond', 'character', 'Edmond, le veilleur', 'Un vieil homme en manteau, une crécelle à la ceinture.', ['personnage'], { x: 0.48, y: 0.3, w: 0.08, h: 0.4 }, 5, { humeur: 'méfiant' }, '#2e4a6b'),
    ],
  },
  characters: [
    {
      name: 'Edmond',
      background: `Veilleur de nuit du quartier depuis trente ans. Il fait sa ronde entre ${prev} et le port et note tout ce qui bouge.`,
      personality: 'méfiant, pointilleux, aime se sentir utile',
      mood: 'méfiant',
      elementHint: 'edmond',
    },
  ],
});

const cellar: NextTheme = (prev, v) => ({
  name: `Cave voûtée${suffix(v)}`,
  description: `Une cave humide sous ${prev}. Ça sent le vin aigre et la pierre mouillée.`,
  scenePrompt: `Cave voûtée en pierre, tonneaux, étagère de bouteilles, coffre, contrebandier endormi, escalier vers ${prev}.`,
  layout: {
    width: SCENE_W,
    height: SCENE_H,
    palette: { wall: '#3d3a3f', floor: '#2b2622', accent: '#9a7b4f' },
    shapes: [
      s('wall', 'wall', 'Murs de pierre', 'Des murs de pierre suintants.', ['fond', 'mur'], { x: 0, y: 0, w: 1, h: 0.6 }, 0),
      s('floor', 'floor', 'Sol de terre battue', 'De la terre battue, froide.', ['fond', 'sol'], { x: 0, y: 0.6, w: 1, h: 0.4 }, 0),
      s('back', 'stairs', `Escalier vers ${prev}`, `Des marches qui remontent vers ${prev}.`, ['escalier', 'sortie', 'passage'], { x: 0.04, y: 0.2, w: 0.18, h: 0.45 }, 2),
      s('shelf', 'shelf', 'Étagère de bouteilles', 'Des bouteilles poussiéreuses alignées.', ['meuble', 'fouillable'], { x: 0.3, y: 0.15, w: 0.2, h: 0.42 }, 2, { contient: 'Bouteille de vin' }),
      s('barrel1', 'barrel', 'Gros tonneau', 'Un énorme tonneau de chêne.', ['tonneau', 'meuble'], { x: 0.55, y: 0.45, w: 0.1, h: 0.25 }, 3),
      s('barrel2', 'barrel', 'Petit tonneau', 'Un tonneau plus petit, marqué d’une croix.', ['tonneau', 'meuble'], { x: 0.66, y: 0.52, w: 0.07, h: 0.18 }, 3),
      s('lamp', 'lamp', 'Lampe tempête', 'Une lampe tempête posée sur un tonneau.', ['lumière', 'portable', 'objet'], { x: 0.58, y: 0.33, w: 0.04, h: 0.12 }, 4, { allumé: true }),
      s('ironDoor', 'door', 'Porte de fer rouillée', 'Une porte de fer, rongée par la rouille.', ['porte', 'sortie', 'ouvrable'], { x: 0.84, y: 0.18, w: 0.12, h: 0.45 }, 2, { ouvert: false }, '#5a5f66'),
      s('gaspard', 'character', 'Gaspard, le contrebandier', 'Un homme barbu, affalé contre un tonneau.', ['personnage'], { x: 0.74, y: 0.5, w: 0.09, h: 0.3 }, 5, { humeur: 'endormi' }, '#4b5a2e'),
    ],
  },
  characters: [
    {
      name: 'Gaspard',
      background: `Contrebandier qui entrepose ses tonneaux sous ${prev}. Il s'est endormi après avoir trop goûté la marchandise.`,
      personality: 'rusé, grognon au réveil, généreux une fois amadoué',
      mood: 'endormi',
      elementHint: 'gaspard',
    },
  ],
});

const garden: NextTheme = (prev, v) => ({
  name: `Jardin du cloître${suffix(v)}`,
  description: `Un petit jardin clos, à deux pas de ${prev}. Une fontaine murmure.`,
  scenePrompt: `Jardin de cloître de nuit, fontaine, arbre, banc, religieuse, arche vers ${prev}, porte de chapelle.`,
  layout: {
    width: SCENE_W,
    height: SCENE_H,
    palette: { wall: '#6b6257', floor: '#34502f', accent: '#d6c18a' },
    shapes: [
      s('sky', 'sky', 'Ciel', 'Un ciel profond et calme.', ['fond', 'ciel'], { x: 0, y: 0, w: 1, h: 0.3 }, 0),
      s('wall', 'wall', 'Mur du cloître', 'Un mur de pierre blonde couvert de lierre.', ['fond', 'mur'], { x: 0, y: 0.3, w: 1, h: 0.25 }, 0),
      s('grass', 'ground', 'Pelouse', 'Une herbe rase et humide.', ['fond', 'sol', 'végétal'], { x: 0, y: 0.55, w: 1, h: 0.45 }, 0, {}, '#34502f'),
      s('back', 'archway', `Arche vers ${prev}`, `L'arche par laquelle on revient vers ${prev}.`, ['passage', 'sortie'], { x: 0.03, y: 0.22, w: 0.14, h: 0.4 }, 2),
      s('tree', 'tree', 'Vieux tilleul', 'Un tilleul noueux.', ['végétal', 'arbre'], { x: 0.2, y: 0.05, w: 0.2, h: 0.6 }, 2),
      s('fountain', 'fountain', 'Fontaine', 'Une fontaine de pierre à l’eau claire.', ['eau', 'décor'], { x: 0.45, y: 0.5, w: 0.18, h: 0.22 }, 3, { trouble: false }),
      s('bench', 'bench', 'Banc de pierre', 'Un banc patiné par les prières.', ['meuble', 'siège'], { x: 0.66, y: 0.62, w: 0.14, h: 0.1 }, 3),
      s('chapel', 'door', 'Porte de la chapelle', 'Une porte en ogive, peinte en bleu.', ['porte', 'sortie', 'ouvrable'], { x: 0.84, y: 0.2, w: 0.11, h: 0.42 }, 2, { ouvert: false }, '#2e4f7a'),
      s('agathe', 'character', 'Sœur Agathe', 'Une religieuse aux mains terreuses.', ['personnage'], { x: 0.7, y: 0.3, w: 0.08, h: 0.36 }, 5, { humeur: 'sereine' }, '#2b2b33'),
    ],
  },
  characters: [
    {
      name: 'Sœur Agathe',
      background: `Jardinière du cloître. Elle soigne les plantes et écoute les confidences des gens de ${prev}.`,
      personality: 'douce, curieuse, un brin malicieuse',
      mood: 'sereine',
      elementHint: 'agathe',
    },
  ],
});

export const NEXT_THEMES: NextTheme[] = [alley, cellar, garden];
