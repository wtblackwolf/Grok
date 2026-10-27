/**
 * Système de perception : décide qui perçoit quoi.
 *
 * Règles (volontairement simples, extensibles) :
 *  - l'auteur d'un événement le « vit » (lived) ;
 *  - sinon il faut être dans le même lieu ;
 *  - 'visible' -> vu, 'audible' -> entendu, 'hidden' -> personne ;
 *  - un personnage endormi / inconscient ne perçoit que les événements très marquants et audibles.
 *
 * Les prompts de dialogue ne reçoivent QUE la mémoire construite ici, jamais le WorldState global.
 */
import type { Character, MemoryEntry, PerceptionChannel, WorldEvent } from './types';

export const MEMORY_LIMIT = 50;
const UNCONSCIOUS = ['endormi', 'endormie', 'inconscient', 'inconsciente'];

export function perceptionChannel(character: Character, event: WorldEvent): PerceptionChannel | null {
  if (event.actorId === character.id) return 'lived';
  if (event.perception === 'hidden') return null;
  if (character.locationId !== event.locationId) return null;
  if (UNCONSCIOUS.includes(character.mood.toLowerCase())) {
    return event.perception === 'audible' && event.salience >= 3 ? 'heard' : null;
  }
  return event.perception === 'visible' ? 'seen' : 'heard';
}

/** Reformule l'événement du point de vue du personnage. */
export function toMemoryEntry(character: Character, event: WorldEvent, channel: PerceptionChannel): MemoryEntry {
  let summary = event.description;
  if (channel === 'heard' && event.kind !== 'speech') summary = `J'ai entendu : ${event.description}`;
  if (channel === 'lived' && event.kind === 'speech') summary = `J'ai dit : ${event.description}`;
  if (event.targetCharacterId === character.id && channel !== 'lived') summary += " (Cela me concernait.)";
  return { eventId: event.id, turn: event.turn, channel, summary };
}

export interface Perception {
  characterId: string;
  entry: MemoryEntry;
}

/** Calcule toutes les perceptions d'un événement (sans muter les personnages). */
export function perceive(characters: Iterable<Character>, event: WorldEvent): Perception[] {
  const out: Perception[] = [];
  for (const c of characters) {
    const channel = perceptionChannel(c, event);
    if (channel) out.push({ characterId: c.id, entry: toMemoryEntry(c, event, channel) });
  }
  return out;
}

/** Ajoute une entrée à la mémoire d'un personnage (en place), en bornant sa taille. */
export function remember(character: Character, entry: MemoryEntry, limit = MEMORY_LIMIT): void {
  if (character.memory.some((m) => m.eventId === entry.eventId)) return;
  character.memory.push(entry);
  if (character.memory.length > limit) character.memory.splice(0, character.memory.length - limit);
}
