/**
 * Modèle de données partagé client/serveur.
 *
 * Conventions :
 *  - toutes les coordonnées d'image sont NORMALISÉES dans [0, 1] (x vers la droite, y vers le bas),
 *    ce qui rend le hit-testing indépendant de la résolution et de la taille d'écran ;
 *  - tout ce qui est ici doit rester sérialisable en JSON (sauvegarde, transport HTTP, prompts LLM).
 */

// ---------------------------------------------------------------------------
// Géométrie
// ---------------------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}

/** Polygone fermé (le dernier point rejoint implicitement le premier). */
export type Polygon = Vec2[];

/** Boîte englobante normalisée. */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rectangle en pixels de l'image source (entiers). */
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/** Référence vers une image servie par le serveur (`GET /api/image/:id`). */
export interface ImageRef {
  id: string;
  url: string;
  width: number;
  height: number;
}

/** Mise à jour partielle : seule la région `pixelRect` de l'image doit être recomposée. */
export interface ImagePatch {
  locationId: string;
  /** Région normalisée modifiée. */
  region: BBox;
  /** Même région, en pixels de l'image complète (arrondie côté serveur). */
  pixelRect: PixelRect;
  /** Image de la taille de `pixelRect` à coller à cet endroit. */
  image: ImageRef;
  /** Nouvelle image complète (après patch) : sert à la restauration et aux ré-analyses. */
  fullImage: ImageRef;
  /** Version de l'image du lieu après application du patch. */
  version: number;
}

// ---------------------------------------------------------------------------
// Monde
// ---------------------------------------------------------------------------

export type ElementStateValue = string | number | boolean;
export type ElementState = Record<string, ElementStateValue>;

/** Un élément visible et sélectionnable de la scène. */
export interface SceneElement {
  id: string;
  name: string;
  description: string;
  /** Contour normalisé utilisé pour le hit-testing. */
  polygon: Polygon;
  bbox: BBox;
  /** Ordre d'empilement : plus grand = au premier plan (prioritaire au toucher). */
  z: number;
  /** État libre (ouvert, allumé, brisé…) : c'est le maître du jeu qui le fait évoluer. */
  state: ElementState;
  /** Étiquettes sémantiques en français (porte, sortie, lumière, personnage, portable…). */
  tags: string[];
  /** Si l'élément représente un personnage. */
  characterId?: string;
  /** Si l'élément mène à un autre lieu. */
  exitId?: string;
  /** Référence opaque fournie par le VisionProvider (permet de ré-associer après ré-analyse). */
  sourceRef?: string;
}

/** Lien vers un lieu voisin, porté par un élément (porte, passage, escalier…). */
export interface Exit {
  id: string;
  elementId: string;
  label: string;
  /** Absent tant que le lieu de destination n'a pas encore été généré. */
  targetLocationId?: string;
}

export interface Location {
  id: string;
  name: string;
  description: string;
  /** Image complète courante (base + tous les patchs déjà appliqués). */
  image: ImageRef;
  imageVersion: number;
  elements: SceneElement[];
  exits: Exit[];
  /** Tour de création, utile pour le débogage. */
  createdAtTurn: number;
}

export type PerceptionChannel = 'seen' | 'heard' | 'lived';

/** Ce qu'un personnage retient d'un événement, de SON point de vue. */
export interface MemoryEntry {
  eventId: string;
  turn: number;
  channel: PerceptionChannel;
  /** Résumé diégétique (jamais de vocabulaire d'interface). */
  summary: string;
}

export interface Character {
  id: string;
  name: string;
  /** Courte histoire cohérente avec le lieu. */
  background: string;
  personality: string;
  mood: string;
  locationId: string;
  /** Élément de la scène qui le représente. */
  elementId?: string;
  /** Mémoire perçue : la SEULE connaissance du monde que reçoit le DialogueProvider. */
  memory: MemoryEntry[];
}

export interface Item {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export type WorldEventKind = 'action' | 'speech' | 'arrival' | 'departure' | 'change';

/**
 * Événement diégétique du monde. Les événements d'interface (tap, sélection, ouverture de roue)
 * ne deviennent JAMAIS des WorldEvent : les personnages ne peuvent donc pas les percevoir.
 */
export interface WorldEvent {
  id: string;
  turn: number;
  locationId: string;
  /** 'player', 'world' ou l'id d'un personnage. */
  actorId: string;
  kind: WorldEventKind;
  /** Description à la 3e personne, telle qu'un témoin la raconterait. */
  description: string;
  targetElementId?: string;
  targetCharacterId?: string;
  /** visible : vu par les présents ; audible : entendu par les présents ; hidden : personne. */
  perception: 'visible' | 'audible' | 'hidden';
  /** 1 = anodin, 2 = notable, 3 = marquant. */
  salience: 1 | 2 | 3;
}

export interface PlayerState {
  name: string;
  locationId: string;
}

export interface WorldState {
  turn: number;
  player: PlayerState;
  locations: Record<string, Location>;
  characters: Record<string, Character>;
  inventory: Item[];
  history: WorldEvent[];
}

// ---------------------------------------------------------------------------
// Actions & patchs
// ---------------------------------------------------------------------------

/**
 * Action contextuelle affichée sur la roue.
 *  - world  : résolue par le maître du jeu (POST /api/act)
 *  - talk   : ouvre le dialogue avec le personnage
 *  - travel : emprunte la sortie portée par l'élément
 */
export interface GameAction {
  id: string;
  label: string;
  elementId: string;
  type: 'world' | 'talk' | 'travel';
}

export const MAX_ACTIONS = 6;

/** Opérations de modification du monde, produites par le maître du jeu puis appliquées de façon pure. */
export type PatchOp =
  | { op: 'setElementState'; locationId: string; elementId: string; state: ElementState }
  | { op: 'renameElement'; locationId: string; elementId: string; name: string; description?: string }
  | { op: 'removeElement'; locationId: string; elementId: string }
  | { op: 'addElement'; locationId: string; element: SceneElement }
  | { op: 'addItem'; item: Item }
  | { op: 'removeItem'; itemId: string }
  | {
      op: 'setCharacter';
      characterId: string;
      changes: Partial<Pick<Character, 'mood' | 'locationId' | 'elementId'>>;
    }
  | { op: 'setLocationDescription'; locationId: string; description: string }
  | { op: 'setExitTarget'; locationId: string; exitId: string; targetLocationId: string };

export type StatePatch = PatchOp[];

/** Demande de retouche d'image (inpainting) limitée à une région. */
export interface ImageEditRequest {
  locationId: string;
  region: BBox;
  /** Masque optionnel (normalisé). À défaut, la région entière est le masque. */
  mask?: Polygon;
  /** Instruction pour un vrai modèle d'image. */
  prompt: string;
  /**
   * Description structurée du changement. Les vrais providers peuvent l'ignorer (le prompt suffit) ;
   * le provider mock s'en sert pour redessiner la région de façon déterministe.
   */
  subject?: {
    elementId?: string;
    sourceRef?: string;
    state?: ElementState;
    remove?: boolean;
    add?: Array<{ kind: string; name: string; description: string; tags: string[]; bbox: BBox }>;
  };
}

/** Ligne de dialogue diégétique. */
export interface DialogueLine {
  speakerId: string;
  speakerName: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Vues & API HTTP
// ---------------------------------------------------------------------------

export interface ElementView {
  id: string;
  name: string;
  polygon: Polygon;
  bbox: BBox;
  z: number;
  tags: string[];
  characterId?: string;
  exitId?: string;
}

export interface CharacterView {
  id: string;
  name: string;
  mood: string;
  elementId?: string;
}

export interface LocationView {
  id: string;
  name: string;
  description: string;
  image: ImageRef;
  imageVersion: number;
  elements: ElementView[];
  exits: Exit[];
  characters: CharacterView[];
}

export interface GameView {
  sessionId: string;
  turn: number;
  location: LocationView;
  inventory: Item[];
}

export interface SessionResponse {
  view: GameView;
  narration?: string;
}

export interface ActionsResponse {
  elementId: string;
  actions: GameAction[];
}

export interface ActRequest {
  sessionId: string;
  elementId: string;
  actionId: string;
}

export interface ActResponse {
  view: GameView;
  narration?: string;
  imagePatch?: ImagePatch;
  reactions: DialogueLine[];
  travelled: boolean;
  /** Renseigné quand l'action est de type 'talk'. */
  openDialogueWith?: string;
}

export interface TalkRequest {
  sessionId: string;
  characterId: string;
  text: string;
}

export interface TalkResponse {
  lines: DialogueLine[];
  view: GameView;
}

export interface TravelRequest {
  sessionId: string;
  exitId: string;
}

export interface TravelResponse {
  view: GameView;
  narration?: string;
  reactions: DialogueLine[];
  /** true si le lieu vient d'être généré, false s'il a été restauré. */
  generated: boolean;
}

export interface ApiError {
  error: string;
}
