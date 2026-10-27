import { describe, expect, it } from 'vitest';
import { buildDialogueMessages } from '../src/providers/llm/prompts';
import type { CharacterPerspective } from '../src/providers/ports';

describe('prompt de dialogue', () => {
  it('ne contient que la perspective du personnage, sans vocabulaire d’interface', () => {
    const p: CharacterPerspective = {
      character: { id: 'c', name: 'Marthe', background: 'Aubergiste.', personality: 'bourrue', mood: 'calme' },
      memory: [{ eventId: 'e1', turn: 1, channel: 'seen', summary: 'Le voyageur allume la lampe.' }],
      surroundings: { locationName: 'Taverne', locationDescription: 'Enfumée', visibleThings: ['Table'], presentPeople: ['un voyageur'] },
    };
    const [system, user] = buildDialogueMessages(p, 'Bonsoir');
    expect(system.content).toContain('[vu] Le voyageur allume la lampe.');
    expect(system.content).not.toMatch(/clic|bouton|roue|écran/i);
    expect(user.content).toBe('Bonsoir');
  });
});
