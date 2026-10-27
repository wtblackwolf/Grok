import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ActResponse, ActionsResponse, GameView, SessionResponse, TalkResponse, TravelResponse } from '@pnc/shared';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';

/** Parcours complet via HTTP, providers MOCK (hors ligne). */
describe('API — parcours de jeu avec les mocks', () => {
  let app: FastifyInstance;
  let sessionId = '';
  let view: GameView;

  const get = async <T>(url: string) => {
    const r = await app.inject({ method: 'GET', url });
    expect(r.statusCode, r.body).toBe(200);
    return r.json() as T;
  };
  const post = async <T>(url: string, payload: object) => {
    const r = await app.inject({ method: 'POST', url, payload });
    expect(r.statusCode, r.body).toBe(200);
    return r.json() as T;
  };
  const el = (name: string) => {
    const e = view.location.elements.find((x) => x.name.toLowerCase().includes(name.toLowerCase()));
    if (!e) throw new Error(`élément ${name} absent : ${view.location.elements.map((x) => x.name).join(', ')}`);
    return e;
  };
  const actions = async (elementId: string) =>
    (await get<ActionsResponse>(`/api/actions?sessionId=${sessionId}&elementId=${elementId}`)).actions;
  const act = async (name: string, label: string) => {
    const e = el(name);
    const a = (await actions(e.id)).find((x) => x.label.startsWith(label));
    if (!a) throw new Error(`action ${label} absente pour ${name}`);
    const res = await post<ActResponse>('/api/act', { sessionId, elementId: e.id, actionId: a.id });
    view = res.view;
    return res;
  };
  const state = () => get<{ world: import('@pnc/shared').WorldState }>(`/api/state?sessionId=${sessionId}`);

  beforeAll(async () => {
    app = await buildApp({ config: { ...loadConfig({}), saveDir: '/tmp/pnc-test-saves' } });
    const res = await post<SessionResponse>('/api/session', {});
    sessionId = res.view.sessionId;
    view = res.view;
  });
  afterAll(() => app.close());

  it('crée une scène où tout est sélectionnable (porte, table, lampe, personnage, murs…)', async () => {
    expect(view.location.name).toBe('Taverne du Corbeau');
    const names = view.location.elements.map((e) => e.name);
    for (const n of ['Porte', 'Table', 'Lampe', 'Marthe', 'Mur', 'Plancher']) expect(names.join('|')).toContain(n);
    expect(view.location.characters).toHaveLength(1);
    const img = await app.inject({ method: 'GET', url: view.location.image.url });
    expect(img.headers['content-type']).toContain('image/svg+xml');
  });

  it('propose au plus 6 actions contextuelles', async () => {
    for (const e of view.location.elements) {
      const list = await actions(e.id);
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(6);
    }
    const lamp = await actions(el('Lampe').id);
    expect(lamp.map((a) => a.label)).toContain('Allumer');
  });

  it('allumer la lampe change l’état et ne repeint que sa région', async () => {
    const lamp = el('Lampe');
    const before = view.location.image.id;
    const res = await act('Lampe', 'Allumer');
    expect(res.imagePatch).toBeDefined();
    const p = res.imagePatch!;
    expect(p.region.x).toBeLessThanOrEqual(lamp.bbox.x);
    expect(p.region.x + p.region.w).toBeGreaterThanOrEqual(lamp.bbox.x + lamp.bbox.w);
    expect(p.region.w * p.region.h).toBeLessThan(0.05); // petite région, pas toute l'image
    expect(p.pixelRect.w).toBeLessThan(200);
    expect(res.view.location.image.id).not.toBe(before);
    expect(res.view.location.imageVersion).toBe(2);
    const patchImg = await app.inject({ method: 'GET', url: p.image.url });
    expect(patchImg.body).toContain(`width="${p.pixelRect.w}"`);
    const w = (await state()).world;
    const lampState = Object.values(w.locations)[0].elements.find((e) => e.id === lamp.id)!.state;
    expect(lampState.allumé).toBe(true);
    expect(res.reactions.some((r) => r.speakerName === 'Marthe')).toBe(true); // elle a vu la scène
  });

  it('ouvrir le coffre révèle un nouvel élément (ré-analyse de la région) que l’on peut prendre', async () => {
    const res = await act('Coffre', 'Ouvrir');
    expect(res.narration).toContain('clé');
    expect(el('Clé rouillée')).toBeDefined();
    await act('Clé rouillée', 'Prendre');
    expect(view.inventory.map((i) => i.name)).toContain('Clé rouillée');
    expect(view.location.elements.some((e) => e.name === 'Clé rouillée')).toBe(false);
  });

  it('parler au personnage : réplique diégétique fondée sur sa mémoire', async () => {
    const marthe = view.location.characters[0];
    const r = await post<TalkResponse>('/api/talk', { sessionId, characterId: marthe.id, text: "Qu'avez-vous vu ce soir ?" });
    expect(r.lines[0].speakerName).toBe('Marthe');
    expect(r.lines[0].text.toLowerCase()).toMatch(/lampe|coffre|clé/);
  });

  let tavernId = '';
  let tavernImage = '';
  let alleyId = '';

  it('franchir la porte génère un nouveau lieu cohérent', async () => {
    tavernId = view.location.id;
    tavernImage = view.location.image.id;
    await act('Porte de la taverne', 'Ouvrir');
    tavernImage = view.location.image.id;
    const res = await act('Porte de la taverne', 'Franchir');
    expect(res.travelled).toBe(true);
    expect(view.location.id).not.toBe(tavernId);
    expect(view.location.description).toContain('Taverne du Corbeau');
    alleyId = view.location.id;
    const back = view.location.exits.find((x) => x.targetLocationId === tavernId);
    expect(back).toBeDefined();
  });

  it('les personnages ne savent que ce qu’ils ont perçu', async () => {
    const edmond = view.location.characters[0];
    const w = (await state()).world;
    const mem = w.characters[edmond.id].memory.map((m) => m.summary).join(' ');
    expect(mem).not.toMatch(/lampe|coffre/i);
    const r = await post<TalkResponse>('/api/talk', { sessionId, characterId: edmond.id, text: 'Que savez-vous du coffre ?' });
    expect(r.lines[0].text).not.toMatch(/Clé rouillée/);
    const marthe = Object.values(w.characters).find((c) => c.name === 'Marthe')!;
    expect(marthe.memory.some((m) => m.summary.includes("s'en va"))).toBe(true);
    expect(marthe.memory.some((m) => m.summary.includes('Edmond'))).toBe(false);
  });

  it('revenir restaure le lieu sauvegardé (même image, mêmes états)', async () => {
    const back = view.location.exits.find((x) => x.targetLocationId === tavernId)!;
    const r = await post<TravelResponse>('/api/travel', { sessionId, exitId: back.id });
    expect(r.generated).toBe(false);
    expect(r.view.location.id).toBe(tavernId);
    expect(r.view.location.image.id).toBe(tavernImage);
    expect(r.view.inventory.map((i) => i.name)).toContain('Clé rouillée');
    view = r.view;
    const door = view.location.exits.find((x) => x.targetLocationId === alleyId);
    expect(door).toBeDefined();
    const again = await post<TravelResponse>('/api/travel', { sessionId, exitId: door!.id });
    expect(again.generated).toBe(false);
    expect(again.view.location.id).toBe(alleyId);
  });

  it('rejette les requêtes invalides proprement', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/act', payload: { sessionId } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/travel', payload: { sessionId: 'nope', exitId: 'x' } })).statusCode).toBe(404);
    const r = await app.inject({ method: 'POST', url: '/api/act', payload: { sessionId, elementId: view.location.elements[0].id, actionId: 'inventée' } });
    expect(r.statusCode).toBe(400);
  });

  it('sauvegarde le monde en JSON', async () => {
    const r = await post<{ file: string }>('/api/save', { sessionId });
    expect(r.file).toContain(sessionId);
  });
});
