/**
 * Client minimal pour une API de chat compatible OpenAI (ex. xAI Grok : LLM_BASE_URL=https://api.x.ai/v1).
 *
 * STUB : la requête HTTP est écrite mais n'a pas été validée contre une vraie API dans cette PR.
 * La clé (LLM_API_KEY) n'est lue que côté serveur et n'est JAMAIS envoyée au client.
 */
import type { ChatMessage } from './prompts';

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export class OpenAICompatibleClient {
  constructor(private cfg: LlmConfig) {}

  async chatJson<T>(messages: ChatMessage[], model = this.cfg.model): Promise<T> {
    if (!this.cfg.apiKey) throw new Error('LLM_API_KEY manquante (voir server/.env.example)');
    const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify({ model, messages, response_format: { type: 'json_object' }, temperature: 0.8 }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return JSON.parse(data.choices[0].message.content) as T;
  }
}
