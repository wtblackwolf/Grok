/**
 * PORTS (architecture hexagonale) : les interfaces que le moteur utilise pour parler aux IA.
 * Le moteur (engine/GameSession) ne dépend QUE de ces interfaces ; les implémentations
 * vivent dans providers/mock (hors ligne, déterministe) et providers/llm|image (vraies API, stubs).
 */
import type {
  Character,
  DetectedElement,
  DialogueLine,
  ElementState,
  GameAction,
  ImageEditRequest,
  ImageRef,
  Item,
  Location,
  MemoryEntry,
  SceneElement,
  StatePatch,
  BBox,
  Exit,
  WorldState,
  WorldEvent,
} from '@pnc/shared';

// ---------------------------------------------------------------------------
// Maître du jeu
// ---------------------------------------------------------------------------

export interface ActionContext {
  element: SceneElement;
  location: Location;
  /** Le MJ est omniscient : il reçoit l'état complet (contrairement aux personnages). */
  world: WorldState;
}

/** Événement à enregistrer (id/tour/lieu sont complétés par le moteur). */
export type WorldEventDraft = Omit<WorldEvent, 'id' | 'turn' | 'locationId'> & { locationId?: string };

export interface ActionResolution {
  patch: StatePatch;
  events: WorldEventDraft[];
  narration?: string;
  imageEdit?: ImageEditRequest;
  /** Si l'action fait changer de lieu, l'id de la sortie empruntée. */
  travelExitId?: string;
}

export interface GameMasterProvider {
  /** Au plus MAX_ACTIONS (6) actions contextuelles pour cet élément, générées à la volée. */
  describeActions(ctx: ActionContext): Promise<Array<Omit<GameAction, 'elementId'>>>;
  /** Interprète l'action contre l'état du monde et renvoie les changements. */
  resolveAction(action: GameAction, ctx: ActionContext): Promise<ActionResolution>;
}

// ---------------------------------------------------------------------------
// Dialogues diégétiques
// ---------------------------------------------------------------------------

/**
 * Ce que perçoit un personnage, et RIEN d'autre : sa fiche, sa mémoire, et ce qu'il voit autour de lui.
 * Jamais le WorldState global ni des notions d'interface.
 */
export interface CharacterPerspective {
  character: Pick<Character, 'id' | 'name' | 'background' | 'personality' | 'mood'>;
  memory: MemoryEntry[];
  surroundings: { locationName: string; locationDescription: string; visibleThings: string[]; presentPeople: string[] };
}

export interface DialogueProvider {
  /** Réplique à ce que le joueur vient de dire (déjà présent dans la mémoire du personnage). */
  reply(p: CharacterPerspective, playerText: string): Promise<{ text: string; mood?: string }>;
  /** Réaction spontanée (ou null) à un souvenir tout juste perçu. */
  react(p: CharacterPerspective, perceived: MemoryEntry): Promise<{ text: string; mood?: string } | null>;
}

// ---------------------------------------------------------------------------
// Images & vision
// ---------------------------------------------------------------------------

export interface GenerateSceneRequest {
  prompt: string;
  width: number;
  height: number;
  /** Spécification structurée optionnelle (utilisée par le mock ; ignorable par un vrai modèle). */
  spec?: unknown;
}

export interface InpaintRequest extends ImageEditRequest {
  image: ImageRef;
}

export interface InpaintResult {
  /** Nouvelle image complète. */
  image: ImageRef;
  /** Image de la seule région modifiée (taille = rectangle pixel de la région). */
  patch: ImageRef;
}

export interface ImageProvider {
  generateScene(req: GenerateSceneRequest): Promise<ImageRef>;
  inpaint(req: InpaintRequest): Promise<InpaintResult>;
}

export interface VisionProvider {
  /** Segmente l'image (ou seulement `region`) en éléments nommés avec contours normalisés. */
  segment(image: ImageRef, region?: BBox): Promise<DetectedElement[]>;
}

// ---------------------------------------------------------------------------
// Génération de lieux
// ---------------------------------------------------------------------------

export interface CharacterDraft {
  name: string;
  background: string;
  personality: string;
  mood: string;
  /** Nom (ou sourceRef) de l'élément visuel qui le représente. */
  elementHint: string;
}

export interface LocationDraft {
  name: string;
  description: string;
  scenePrompt: string;
  /** Spécification structurée pour l'ImageProvider (mock). */
  spec?: unknown;
  /** Nom (ou sourceRef) de l'élément qui ramène au lieu précédent. */
  backExitHint?: string;
  characters: CharacterDraft[];
}

export interface LocationGenerator {
  initial(): Promise<LocationDraft>;
  /** Nouveau lieu cohérent avec `previous`, atteint par `via`. */
  next(previous: Location, via: Exit, world: WorldState): Promise<LocationDraft>;
}

export interface Providers {
  gameMaster: GameMasterProvider;
  dialogue: DialogueProvider;
  image: ImageProvider;
  vision: VisionProvider;
  locations: LocationGenerator;
}

// Ré-export pratique pour les adaptateurs.
export type { ElementState, Item };
