/**
 * Constructeurs de prompts pour les vrais LLM (implémentés et testés, utilisés par les adaptateurs).
 * Règle d'or : un prompt de DIALOGUE ne contient que la perspective du personnage.
 */
import type { GameAction } from '@pnc/shared';
import type { ActionContext, CharacterPerspective } from '../ports';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function buildDialogueMessages(p: CharacterPerspective, playerText: string): ChatMessage[] {
  const memory = p.memory.map((m) => `- [${m.channel === 'seen' ? 'vu' : m.channel === 'heard' ? 'entendu' : 'vécu'}] ${m.summary}`).join('\n');
  return [
    {
      role: 'system',
      content:
        `Tu es ${p.character.name}, un personnage d'un jeu d'aventure. Reste TOUJOURS dans ton rôle, en français.\n` +
        `Histoire : ${p.character.background}\nPersonnalité : ${p.character.personality}\nHumeur : ${p.character.mood}\n` +
        `Tu es dans : ${p.surroundings.locationName} — ${p.surroundings.locationDescription}\n` +
        `Tu vois : ${p.surroundings.visibleThings.join(', ')}. Personnes présentes : ${p.surroundings.presentPeople.join(', ') || 'personne'}.\n` +
        `Tu ne sais QUE ce qui figure dans tes souvenirs ci-dessous. Tu ignores tout le reste du monde ` +
        `et tu n'as aucune notion de jeu, d'interface ou de joueur : tu parles à « un voyageur ».\n` +
        `Souvenirs (du plus ancien au plus récent) :\n${memory || '- (rien de notable)'}\n` +
        `Réponds en 1 à 3 phrases. Réponds en JSON : {"text": string, "mood"?: string}.`,
    },
    { role: 'user', content: playerText },
  ];
}

export function buildDescribeActionsMessages(ctx: ActionContext): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'Tu es le maître du jeu d’un point-and-click sans script. Propose au plus 6 actions courtes (1 à 3 mots, ' +
        'en français, à l’infinitif) pertinentes pour l’élément, selon son état et le contexte. ' +
        'Réponds en JSON : {"actions": [{"id": string, "label": string, "type": "world"|"talk"|"travel"}]}.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        lieu: { nom: ctx.location.name, description: ctx.location.description },
        element: { id: ctx.element.id, nom: ctx.element.name, description: ctx.element.description, etat: ctx.element.state, tags: ctx.element.tags },
        inventaire: ctx.world.inventory.map((i) => i.name),
      }),
    },
  ];
}

export function buildResolveActionMessages(action: GameAction, ctx: ActionContext): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'Tu es le maître du jeu. Interprète l’action du voyageur contre l’état du monde, sans script, de façon cohérente. ' +
        'Réponds en JSON : {"patch": PatchOp[], "events": [{"actorId","kind","description","perception","salience","targetElementId"?,"targetCharacterId"?}], ' +
        '"narration"?: string, "imageEdit"?: {"region": {"x","y","w","h"} (normalisé 0..1, le plus petit possible), "prompt": string}, "travelExitId"?: string}. ' +
        'Les descriptions d’événements sont à la 3e personne (« Le voyageur… ») et purement diégétiques.',
    },
    {
      role: 'user',
      content: JSON.stringify({ action, element: ctx.element, lieu: { id: ctx.location.id, nom: ctx.location.name, elements: ctx.location.elements.map((e) => ({ id: e.id, nom: e.name, etat: e.state, bbox: e.bbox })) }, monde: { tour: ctx.world.turn, inventaire: ctx.world.inventory } }),
    },
  ];
}
