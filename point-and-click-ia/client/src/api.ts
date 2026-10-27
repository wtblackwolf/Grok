/** Client HTTP typé vers le serveur de jeu. */
import type {
  ActResponse,
  ActionsResponse,
  ApiError,
  SessionResponse,
  TalkResponse,
  TravelResponse,
} from '@pnc/shared';

async function request<T>(method: 'GET' | 'POST', url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({ error: res.statusText }))) as T | ApiError;
  if (!res.ok) throw new Error((data as ApiError).error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  newSession: () => request<SessionResponse>('POST', '/api/session', {}),
  actions: (sessionId: string, elementId: string) =>
    request<ActionsResponse>('GET', `/api/actions?sessionId=${encodeURIComponent(sessionId)}&elementId=${encodeURIComponent(elementId)}`),
  act: (sessionId: string, elementId: string, actionId: string) => request<ActResponse>('POST', '/api/act', { sessionId, elementId, actionId }),
  talk: (sessionId: string, characterId: string, text: string) => request<TalkResponse>('POST', '/api/talk', { sessionId, characterId, text }),
  travel: (sessionId: string, exitId: string) => request<TravelResponse>('POST', '/api/travel', { sessionId, exitId }),
};
