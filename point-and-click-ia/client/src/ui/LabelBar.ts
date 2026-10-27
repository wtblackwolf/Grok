/** Barre du bas : nom de l'élément touché + narration du maître du jeu. */
export class LabelBar {
  private timer: number | undefined;
  constructor(
    private nameEl: HTMLElement,
    private narrationEl: HTMLElement,
  ) {}

  showName(name: string | null): void {
    this.nameEl.textContent = name ?? 'Touchez un élément de la scène';
    this.nameEl.classList.toggle('muted', !name);
    this.nameEl.classList.remove('pop');
    void this.nameEl.offsetWidth; // relance l'animation
    this.nameEl.classList.add('pop');
  }

  narrate(text: string | undefined): void {
    window.clearTimeout(this.timer);
    this.narrationEl.textContent = text ?? '';
    if (text) this.timer = window.setTimeout(() => (this.narrationEl.textContent = ''), 9000);
  }
}
