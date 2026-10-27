/** Sessions en mémoire (+ sauvegarde JSON optionnelle). */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Providers } from '../providers/ports';
import { GameSession } from './GameSession';
import { HttpError } from './errors';

export class SessionStore {
  private sessions = new Map<string, GameSession>();
  constructor(private providers: Providers) {}

  async create(): Promise<{ session: GameSession; narration: string }> {
    const session = new GameSession(randomUUID(), this.providers);
    const { narration } = await session.init();
    this.sessions.set(session.id, session);
    return { session, narration };
  }

  get(id: unknown): GameSession {
    const s = typeof id === 'string' ? this.sessions.get(id) : undefined;
    if (!s) throw new HttpError(404, 'Session inconnue (le serveur a peut-être redémarré).');
    return s;
  }

  async save(id: string, dir: string): Promise<string> {
    const s = this.get(id);
    const abs = resolve(dir);
    await mkdir(abs, { recursive: true });
    const file = join(abs, `${s.id}.json`);
    await writeFile(file, JSON.stringify(s.toJSON(), null, 2), 'utf8');
    return file;
  }
}
