/**
 * Adaptateurs LLM réels — STUBS documentés.
 *
 * À implémenter : appeler `OpenAICompatibleClient.chatJson` avec les prompts de `prompts.ts`,
 * puis VALIDER la sortie (ex. zod) avant de la rendre au moteur. Le moteur tolère déjà des patchs
 * partiellement invalides (applyPatch ignore et signale les opérations incorrectes).
 */
import type { GameAction, Exit, Location, MemoryEntry, WorldState } from '@pnc/shared';
import type {
  ActionContext,
  ActionResolution,
  CharacterPerspective,
  DialogueProvider,
  GameMasterProvider,
  LocationDraft,
  LocationGenerator,
} from '../ports';
import type { OpenAICompatibleClient } from './openaiCompatibleClient';

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`${what} : adaptateur réel non implémenté (utilisez TEXT_PROVIDER=mock / IMAGE_PROVIDER=mock).`);
  }
}

/** TODO: describeActions -> buildDescribeActionsMessages ; resolveAction -> buildResolveActionMessages. */
export class LlmGameMaster implements GameMasterProvider {
  constructor(readonly client: OpenAICompatibleClient) {}
  async describeActions(_ctx: ActionContext): Promise<Array<Omit<GameAction, 'elementId'>>> {
    throw new NotImplementedError('LlmGameMaster.describeActions');
  }
  async resolveAction(_action: GameAction, _ctx: ActionContext): Promise<ActionResolution> {
    throw new NotImplementedError('LlmGameMaster.resolveAction');
  }
}

/** TODO: reply -> buildDialogueMessages ; react -> idem avec le souvenir perçu comme « déclencheur ». */
export class LlmDialogue implements DialogueProvider {
  constructor(readonly client: OpenAICompatibleClient) {}
  async reply(_p: CharacterPerspective, _text: string): Promise<{ text: string; mood?: string }> {
    throw new NotImplementedError('LlmDialogue.reply');
  }
  async react(_p: CharacterPerspective, _m: MemoryEntry): Promise<{ text: string; mood?: string } | null> {
    throw new NotImplementedError('LlmDialogue.react');
  }
}

/**
 * TODO: demander au LLM un lieu voisin cohérent (nom, description, prompt d'image, 1 élément « retour »
 * nommé explicitement, 0-2 personnages avec background lié au lieu précédent).
 */
export class LlmLocationGenerator implements LocationGenerator {
  constructor(readonly client: OpenAICompatibleClient) {}
  async initial(): Promise<LocationDraft> {
    throw new NotImplementedError('LlmLocationGenerator.initial');
  }
  async next(_previous: Location, _via: Exit, _world: WorldState): Promise<LocationDraft> {
    throw new NotImplementedError('LlmLocationGenerator.next');
  }
}
