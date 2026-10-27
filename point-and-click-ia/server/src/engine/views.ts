/** Projections du WorldState vers ce que le client a le droit de voir. */
import type { GameView, Location, LocationView, WorldState } from '@pnc/shared';

export function toLocationView(world: WorldState, loc: Location): LocationView {
  return {
    id: loc.id,
    name: loc.name,
    description: loc.description,
    image: loc.image,
    imageVersion: loc.imageVersion,
    elements: loc.elements.map((e) => ({
      id: e.id,
      name: e.name,
      polygon: e.polygon,
      bbox: e.bbox,
      z: e.z,
      tags: e.tags,
      characterId: e.characterId,
      exitId: e.exitId,
    })),
    exits: loc.exits,
    characters: Object.values(world.characters)
      .filter((c) => c.locationId === loc.id)
      .map((c) => ({ id: c.id, name: c.name, mood: c.mood, elementId: c.elementId })),
  };
}

export function toGameView(sessionId: string, world: WorldState): GameView {
  return {
    sessionId,
    turn: world.turn,
    location: toLocationView(world, world.locations[world.player.locationId]),
    inventory: world.inventory,
  };
}
