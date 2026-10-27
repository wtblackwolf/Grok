/** Configuration lue depuis l'environnement (voir server/.env.example). */
export interface ServerConfig {
  port: number;
  host: string;
  textProvider: 'mock' | 'llm';
  imageProvider: 'mock' | 'http';
  llm: { baseUrl: string; apiKey: string; model: string; fastModel: string };
  image: { baseUrl: string; apiKey: string; model: string; visionModel: string };
  saveDir: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '127.0.0.1',
    textProvider: env.TEXT_PROVIDER === 'llm' ? 'llm' : 'mock',
    imageProvider: env.IMAGE_PROVIDER === 'http' ? 'http' : 'mock',
    llm: {
      baseUrl: env.LLM_BASE_URL ?? 'https://api.x.ai/v1',
      apiKey: env.LLM_API_KEY ?? '',
      model: env.LLM_MODEL ?? 'grok-4',
      fastModel: env.LLM_FAST_MODEL || env.LLM_MODEL || 'grok-4',
    },
    image: {
      baseUrl: env.IMAGE_BASE_URL ?? '',
      apiKey: env.IMAGE_API_KEY ?? '',
      model: env.IMAGE_MODEL ?? '',
      visionModel: env.VISION_MODEL ?? '',
    },
    saveDir: env.SAVE_DIR ?? './data/saves',
  };
}
