/** LocationGenerator MOCK : choisit un thème de façon déterministe, cohérent avec le lieu quitté. */
import { withArticle, type Exit, type Location, type WorldState } from '@pnc/shared';
import type { LocationDraft, LocationGenerator } from '../ports';
import { NEXT_THEMES, tavernTheme, type ThemeOutput } from './themes';

const toDraft = (t: ThemeOutput, backExitHint?: string): LocationDraft => ({
  name: t.name,
  description: t.description,
  scenePrompt: t.scenePrompt,
  spec: t.layout,
  backExitHint,
  characters: t.characters,
});

export class MockLocationGenerator implements LocationGenerator {
  async initial(): Promise<LocationDraft> {
    return toDraft(tavernTheme());
  }

  async next(previous: Location, _via: Exit, world: WorldState): Promise<LocationDraft> {
    const generated = Object.keys(world.locations).length - 1; // lieux générés après la taverne
    const theme = NEXT_THEMES[generated % NEXT_THEMES.length];
    const variant = Math.floor(generated / NEXT_THEMES.length);
    // « la Taverne du Corbeau » : le nom avec article sert dans les textes du nouveau lieu.
    return toDraft(theme(withArticle(previous.name, { keepCase: true }), variant), 'back');
  }
}
