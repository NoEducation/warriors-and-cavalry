// The enter menu shown before the game starts: title, a seed field, "Random" and "Start".

/** What the start menu needs from the game: its first seed, how to read and roll seeds, and what Start does. */
export interface StartMenuOptions {
  readonly initialSeed: number;
  /** The seed typed as `text`, or null when it is not a valid seed. */
  readonly parseSeed: (text: string) => number | null;
  readonly randomSeed: () => number;
  /** Runs when the player starts with a valid seed; the menu has hidden itself by then. */
  readonly onStart: (seed: number) => void;
}

export class StartMenu {
  private readonly input: HTMLInputElement;
  private readonly hint: HTMLDivElement;

  /** Builds the menu inside `root` and shows it, with the seed field focused. `root` should cover the window. */
  public constructor(
    private readonly root: HTMLElement,
    private readonly options: StartMenuOptions,
  ) {
    const form = root.appendChild(document.createElement('form'));
    form.className = 'panel menu-panel';
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.start();
    });
    form.appendChild(document.createElement('h1')).textContent = 'Warriors and Cavalry';
    form.appendChild(document.createElement('p')).textContent = 'Raise a keep, feed your peasants, hold the land.';

    const label = form.appendChild(document.createElement('label'));
    label.className = 'seed';
    label.appendChild(document.createElement('span')).textContent = 'Map seed';
    this.input = label.appendChild(document.createElement('input'));
    this.input.inputMode = 'numeric';
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;
    this.input.value = String(options.initialSeed);
    this.input.addEventListener('input', () => this.setInvalid(false));
    const random = label.appendChild(this.button('Random', 'button'));
    random.addEventListener('click', () => this.rollSeed());

    this.hint = form.appendChild(document.createElement('div'));
    this.hint.className = 'hint';
    form.appendChild(this.button('Start game', 'submit')).classList.add('primary');

    root.hidden = false;
    this.input.focus();
    this.input.select();
  }

  /** Takes the menu off the screen for good. */
  public hide(): void {
    this.root.hidden = true;
    this.root.replaceChildren();
  }

  private start(): void {
    const seed = this.options.parseSeed(this.input.value);
    if (seed === null) {
      this.setInvalid(true);
      this.input.focus();
      return;
    }
    this.hide();
    this.options.onStart(seed);
  }

  private rollSeed(): void {
    this.input.value = String(this.options.randomSeed());
    this.setInvalid(false);
  }

  private setInvalid(invalid: boolean): void {
    this.input.classList.toggle('invalid', invalid);
    this.hint.textContent = invalid ? 'A seed is a whole number from 0 to 4294967295.' : '';
  }

  private button(text: string, type: 'button' | 'submit'): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = type;
    button.textContent = text;
    return button;
  }
}
