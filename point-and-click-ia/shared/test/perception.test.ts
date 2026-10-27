import { describe, expect, it } from 'vitest';
import { perceive, perceptionChannel, remember } from '../src/perception';
import type { Character, WorldEvent } from '../src/types';

const char = (id: string, locationId: string, mood = 'calme'): Character => ({
  id,
  name: id,
  background: '',
  personality: '',
  mood,
  locationId,
  memory: [],
});

const event = (over: Partial<WorldEvent> = {}): WorldEvent => ({
  id: 'ev1',
  turn: 1,
  locationId: 'taverne',
  actorId: 'player',
  kind: 'action',
  description: 'Le voyageur allume la lampe.',
  perception: 'visible',
  salience: 2,
  ...over,
});

describe('perception', () => {
  it('seuls les personnages présents perçoivent un événement visible', () => {
    const here = char('marthe', 'taverne');
    const away = char('edmond', 'ruelle');
    const p = perceive([here, away], event());
    expect(p.map((x) => x.characterId)).toEqual(['marthe']);
    expect(p[0].entry.channel).toBe('seen');
  });

  it('distingue vu / entendu / vécu, et ignore le caché', () => {
    const c = char('marthe', 'taverne');
    expect(perceptionChannel(c, event({ perception: 'audible' }))).toBe('heard');
    expect(perceptionChannel(c, event({ perception: 'hidden' }))).toBeNull();
    expect(perceptionChannel(c, event({ actorId: 'marthe', locationId: 'ailleurs' }))).toBe('lived');
  });

  it('un personnage endormi n’entend que les fracas', () => {
    const c = char('marthe', 'taverne', 'endormie');
    expect(perceptionChannel(c, event())).toBeNull();
    expect(perceptionChannel(c, event({ perception: 'audible', salience: 3 }))).toBe('heard');
  });

  it('remember dédoublonne et borne la mémoire', () => {
    const c = char('marthe', 'taverne');
    for (let i = 0; i < 5; i++) remember(c, { eventId: `e${i}`, turn: i, channel: 'seen', summary: '' }, 3);
    remember(c, { eventId: 'e4', turn: 4, channel: 'seen', summary: '' }, 3);
    expect(c.memory.map((m) => m.eventId)).toEqual(['e2', 'e3', 'e4']);
  });
});
