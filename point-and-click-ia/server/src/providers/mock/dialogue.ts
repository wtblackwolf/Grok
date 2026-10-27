/**
 * DialogueProvider MOCK : répliques en personnage construites UNIQUEMENT à partir de la
 * perspective du personnage (fiche + mémoire perçue + ce qu'il voit). Déterministe.
 */
import { hashString } from '@pnc/shared';
import type { MemoryEntry } from '@pnc/shared';
import type { CharacterPerspective, DialogueProvider } from '../ports';

const asleep = (mood: string) => /endormi|inconscient/.test(mood);
const STOP = new Set(['avec', 'dans', 'pour', 'vous', 'votre', 'cette', 'quoi', 'est-ce', 'que', 'qui', 'elle', 'avez']);

export class MockDialogueProvider implements DialogueProvider {
  async reply(p: CharacterPerspective, playerText: string): Promise<{ text: string; mood?: string }> {
    const { character: c, memory } = p;
    if (asleep(c.mood)) return { text: 'Rrrrr… zzz… (il ronfle de plus belle)' };
    const t = playerText.toLowerCase();
    const witnessed = memory.filter((m) => m.channel !== 'lived' && !m.summary.startsWith('Le voyageur dit'));
    const gruff = /bourru|méfiant|grognon|rusé/.test(c.personality + c.mood);

    if (/^(bonjour|bonsoir|salut|coucou|hello)/.test(t)) {
      return { text: gruff ? 'Mouais, bonsoir. Vous voulez quelque chose ou vous restez planté là ?' : 'Bonsoir à vous, voyageur. Que la nuit vous soit douce.' };
    }
    if (/(qui es|qui êtes|ton nom|votre nom|présente)/.test(t)) {
      return { text: `${c.name}. ${firstSentence(c.background)}` };
    }
    if (/(vu|remarqu|passé|quoi de neuf|nouvelles|arrivé)/.test(t)) {
      const recent = witnessed.slice(-2);
      if (!recent.length) return { text: 'Rien de spécial. À part vous, personne ne bouge.' };
      return { text: `Ce que j'ai vu ? ${recent.map((m) => `« ${m.summary} »`).join(' Et puis : ')}` };
    }
    // Sujet précis : le personnage ne peut en parler que s'il l'a perçu.
    const words = t.split(/[^\p{L}-]+/u).filter((w) => w.length > 3 && !STOP.has(w));
    if (words.length) {
      const known = [...witnessed].reverse().find((m) => words.some((w) => m.summary.toLowerCase().includes(w)));
      if (known) return { text: `Ah, ça… Oui : « ${known.summary} » Je n'en sais pas plus.` };
      if (words.some((w) => /clé|coffre|lampe|porte|tableau|fenêtre|cave|port/.test(w))) {
        return { text: gruff ? "J'en sais rien, et ça me regarde pas." : "Je ne sais rien de cela, j'en ai peur." };
      }
    }
    const last = witnessed.at(-1);
    const generic = gruff
      ? ['Hm.', 'Si vous le dites.', 'On verra bien.', 'Faites pas d’histoires, c’est tout ce que je demande.']
      : ['Voilà qui est intéressant.', 'Dites-m’en plus.', 'La nuit porte conseil, dit-on.'];
    const base = generic[hashString(c.id + t + memory.length) % generic.length];
    return { text: last && hashString(t) % 2 === 0 ? `${base} Au fait, j'ai remarqué : « ${last.summary} »` : base };
  }

  async react(p: CharacterPerspective, m: MemoryEntry): Promise<{ text: string; mood?: string } | null> {
    const { character: c } = p;
    if (m.channel === 'lived') return null;
    if (asleep(c.mood)) return null;
    const s = m.summary.toLowerCase();
    const aboutMe = s.includes('cela me concernait');
    if (/secoue .* réveiller/.test(s) && aboutMe) return { text: 'Hein ?! Quoi ?! Qui ose… Ah, c’est vous. Ça a intérêt à être important.', mood: 'grognon' };
    if (/offre/.test(s) && aboutMe) return { text: 'Pour moi ? … Eh bien. Merci, voyageur. On ne m’avait pas gâté comme ça depuis longtemps.', mood: 'ravie' };
    if (/salue/.test(s) && aboutMe) return { text: /bourru|méfiant|grognon/.test(c.mood) ? 'Hm. Bonsoir.' : 'Bonsoir, l’ami.' };
    if (/fracas|brise/.test(s)) return { text: 'Par tous les diables, c’est quoi ce vacarme ?!', mood: 'fâchée' };
    if (/prend /.test(s)) return { text: 'Hé ! Ça ne vous appartient pas, ça.' };
    if (/allume/.test(s)) return { text: 'Ah, un peu de lumière. C’est pas trop tôt.' };
    if (/ouvre le coffre|ouvre/.test(s) && hashString(m.eventId + c.id) % 2 === 0) return { text: 'Faites attention à ce que vous ouvrez, ici.' };
    if (/arrive/.test(s) && p.memory.some((x) => x.summary.includes("s'en va"))) return { text: 'Tiens, vous revoilà.' };
    if (/arrive/.test(s)) return { text: /méfiant|bourru|grognon/.test(c.mood) ? 'Tiens… Encore un qui traîne la nuit.' : 'Oh, de la visite. Bienvenue.' };
    if (/frappe/.test(s)) return { text: 'Si personne ne répond, c’est qu’il n’y a personne.' };
    return null;
  }
}

function firstSentence(s: string): string {
  const i = s.indexOf('.');
  return i > 0 ? s.slice(0, i + 1) : s;
}
