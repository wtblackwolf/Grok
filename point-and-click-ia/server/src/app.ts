/** Application HTTP Fastify : routes /api/*. Construite par une fabrique pour être testable (inject). */
import Fastify, { type FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import type {
  ActRequest,
  ActResponse,
  ActionsResponse,
  SessionResponse,
  TalkRequest,
  TalkResponse,
  TravelRequest,
  TravelResponse,
} from '@pnc/shared';
import { loadConfig, type ServerConfig } from './config';
import { HttpError } from './engine/errors';
import { ImageStore } from './engine/imageStore';
import { SessionStore } from './engine/sessionStore';
import { createProviders } from './providers';
import type { Providers } from './providers/ports';

export interface AppOptions {
  config?: ServerConfig;
  images?: ImageStore;
  providers?: Providers;
  logger?: boolean;
  /** Dossier du client buildé à servir (production). */
  staticDir?: string;
}

const str = { type: 'string', minLength: 1 } as const;

export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const config = opts.config ?? loadConfig();
  const images = opts.images ?? new ImageStore();
  const providers = opts.providers ?? createProviders(config, images);
  const sessions = new SessionStore(providers);
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 1_000_000 });

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: err.message });
    if (err.validation) return reply.status(400).send({ error: err.message });
    app.log.error(err);
    return reply.status(500).send({ error: err.message || 'Erreur interne' });
  });

  app.get('/api/health', async () => ({ ok: true, text: config.textProvider, image: config.imageProvider }));

  app.post('/api/session', async (): Promise<SessionResponse> => {
    const { session, narration } = await sessions.create();
    return { view: session.view(), narration };
  });

  app.get<{ Querystring: { sessionId: string; elementId: string } }>(
    '/api/actions',
    { schema: { querystring: { type: 'object', required: ['sessionId', 'elementId'], properties: { sessionId: str, elementId: str } } } },
    async (req): Promise<ActionsResponse> => {
      const actions = await sessions.get(req.query.sessionId).getActions(req.query.elementId);
      return { elementId: req.query.elementId, actions };
    },
  );

  app.post<{ Body: ActRequest }>(
    '/api/act',
    { schema: { body: { type: 'object', required: ['sessionId', 'elementId', 'actionId'], properties: { sessionId: str, elementId: str, actionId: str } } } },
    async (req): Promise<ActResponse> => sessions.get(req.body.sessionId).act(req.body.elementId, req.body.actionId),
  );

  app.post<{ Body: TalkRequest }>(
    '/api/talk',
    { schema: { body: { type: 'object', required: ['sessionId', 'characterId', 'text'], properties: { sessionId: str, characterId: str, text: { type: 'string', minLength: 1, maxLength: 500 } } } } },
    async (req): Promise<TalkResponse> => sessions.get(req.body.sessionId).talk(req.body.characterId, req.body.text),
  );

  app.post<{ Body: TravelRequest }>(
    '/api/travel',
    { schema: { body: { type: 'object', required: ['sessionId', 'exitId'], properties: { sessionId: str, exitId: str } } } },
    async (req): Promise<TravelResponse> => sessions.get(req.body.sessionId).travel(req.body.exitId),
  );

  /** Débogage : état complet du monde (à protéger/désactiver en production). */
  app.get<{ Querystring: { sessionId: string } }>('/api/state', async (req) => sessions.get(req.query.sessionId).toJSON());

  app.post<{ Body: { sessionId: string } }>(
    '/api/save',
    { schema: { body: { type: 'object', required: ['sessionId'], properties: { sessionId: str } } } },
    async (req) => ({ file: await sessions.save(req.body.sessionId, config.saveDir) }),
  );

  app.get<{ Params: { id: string } }>('/api/image/:id', async (req, reply) => {
    const img = images.get(req.params.id);
    if (!img) throw new HttpError(404, 'Image introuvable');
    // Les images sont immuables (chaque retouche crée un nouvel id) : cache agressif.
    return reply.header('cache-control', 'public, max-age=31536000, immutable').type(img.mime).send(img.body);
  });

  // Production : sert le client buildé (en dev, c'est Vite qui le sert et proxifie /api).
  const staticDir = opts.staticDir;
  if (staticDir && existsSync(staticDir)) {
    const root = resolve(staticDir);
    const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
    app.get('/*', async (req, reply) => {
      const url = (req.params as { '*': string })['*'] || 'index.html';
      const file = resolve(join(root, url));
      const target = file.startsWith(root) && existsSync(file) ? file : join(root, 'index.html');
      return reply.type(mime[extname(target)] ?? 'application/octet-stream').send(await readFile(target));
    });
  }

  return app;
}
