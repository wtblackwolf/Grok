/** Panneau de dialogues diégétiques : journal des répliques + saisie libre vers un personnage. */
import type { DialogueLine } from '@pnc/shared';

export class DialoguePanel {
  private target: { id: string; name: string } | null = null;
  onSay: (characterId: string, text: string) => void = () => {};

  constructor(
    private root: HTMLElement,
    private log: HTMLElement,
    private form: HTMLFormElement,
    private input: HTMLInputElement,
    private title: HTMLElement,
    closeBtn: HTMLElement,
  ) {
    closeBtn.addEventListener('click', () => this.hide());
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text || !this.target) return;
      input.value = '';
      this.append({ speakerId: 'player', speakerName: 'Vous', text });
      this.onSay(this.target.id, text);
    });
  }

  /** Ouvre le panneau ; avec un interlocuteur, affiche la saisie. */
  open(target?: { id: string; name: string }): void {
    if (target) this.target = target;
    this.title.textContent = this.target ? `Parler à ${this.target.name}` : 'Dialogues';
    this.form.classList.toggle('hidden', !this.target);
    this.root.classList.remove('hidden');
    if (target && window.matchMedia('(pointer: fine)').matches) this.input.focus();
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.input.blur();
  }

  toggle(): void {
    this.root.classList.contains('hidden') ? this.open() : this.hide();
  }

  /** L'interlocuteur n'est plus là (changement de lieu). */
  clearTarget(): void {
    this.target = null;
    this.form.classList.add('hidden');
    this.title.textContent = 'Dialogues';
  }

  append(line: DialogueLine, kind: 'line' | 'system' = 'line'): void {
    const p = document.createElement('p');
    p.className = kind === 'system' ? 'sys' : line.speakerId === 'player' ? 'me' : 'npc';
    if (kind === 'system') p.textContent = line.text;
    else {
      const b = document.createElement('b');
      b.textContent = `${line.speakerName} : `;
      p.append(b, document.createTextNode(line.text));
    }
    this.log.appendChild(p);
    this.log.scrollTop = this.log.scrollHeight;
  }
}
