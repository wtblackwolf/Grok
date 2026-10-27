/** Fabrique des providers selon la configuration (mock par défaut, 100 % hors ligne). */
import type { ServerConfig } from '../config';
import type { ImageStore } from '../engine/imageStore';
import type { Providers } from './ports';
import { MockDialogueProvider } from './mock/dialogue';
import { MockGameMaster } from './mock/gameMaster';
import { MockImageProvider, MockLayoutRegistry } from './mock/imageProvider';
import { MockLocationGenerator } from './mock/locationGenerator';
import { MockVisionProvider } from './mock/visionProvider';
import { LlmDialogue, LlmGameMaster, LlmLocationGenerator } from './llm/adapters';
import { OpenAICompatibleClient } from './llm/openaiCompatibleClient';
import { HttpImageProvider, HttpVisionProvider } from './image/httpAdapters';

export function createMockProviders(images: ImageStore): Providers {
  const registry = new MockLayoutRegistry();
  return {
    gameMaster: new MockGameMaster(),
    dialogue: new MockDialogueProvider(),
    image: new MockImageProvider(images, registry),
    vision: new MockVisionProvider(registry),
    locations: new MockLocationGenerator(),
  };
}

export function createProviders(config: ServerConfig, images: ImageStore): Providers {
  const providers = createMockProviders(images);
  if (config.textProvider === 'llm') {
    const client = new OpenAICompatibleClient(config.llm);
    providers.gameMaster = new LlmGameMaster(client);
    providers.dialogue = new LlmDialogue(client);
    providers.locations = new LlmLocationGenerator(client);
  }
  if (config.imageProvider === 'http') {
    providers.image = new HttpImageProvider(config.image);
    providers.vision = new HttpVisionProvider(config.image);
  }
  return providers;
}

export type { Providers } from './ports';
