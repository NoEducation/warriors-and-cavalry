// Full-screen loader shown while a map is made: a spinning wheel, a title and the current step.

export class LoadingOverlay {
  private readonly titleLine: HTMLDivElement;
  private readonly stageLine: HTMLDivElement;

  /** Builds the loader inside `root` (hidden until `show`). `root` should cover the window. */
  public constructor(private readonly root: HTMLElement) {
    root.hidden = true;
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    const panel = root.appendChild(document.createElement('div'));
    panel.className = 'panel loading-panel';
    panel.appendChild(document.createElement('div')).className = 'spinner';
    this.titleLine = panel.appendChild(document.createElement('div'));
    this.titleLine.className = 'title';
    this.stageLine = panel.appendChild(document.createElement('div'));
    this.stageLine.className = 'stage';
  }

  /** True while the loader is on screen. */
  public get visible(): boolean {
    return !this.root.hidden;
  }

  /** Shows the loader with `title` (e.g. which map) and an empty step line, covering and blocking the game. */
  public show(title: string): void {
    this.titleLine.textContent = title;
    this.stageLine.textContent = '';
    this.root.classList.remove('failed');
    this.root.hidden = false;
  }

  /** Shows `text` as the current step, e.g. `Shaping the land`. Call as each step starts. */
  public setStage(text: string): void {
    this.stageLine.textContent = `${text}…`;
  }

  /** Shows `text` as an error and stops the wheel; the loader stays up. Call when a load fails. */
  public showError(text: string): void {
    this.root.classList.add('failed');
    this.stageLine.textContent = text;
  }

  /** Takes the loader off the screen. */
  public hide(): void {
    this.root.hidden = true;
  }
}
