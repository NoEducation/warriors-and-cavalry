// Tracks which keys (by KeyboardEvent.code) are currently held on an event target.

export class Keyboard {
  private readonly down = new Set<string>();

  /** Starts listening for key events on `target` (usually `window`). */
  public constructor(private readonly target: EventTarget) {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
  }

  /** True while the key with this `KeyboardEvent.code` (e.g. 'KeyW') is held. Call every frame as needed. */
  public isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** Stops listening and releases all keys. Call when the keyboard is no longer needed. */
  public dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
    this.down.clear();
  }

  private readonly onKeyDown = (e: Event): void => {
    this.down.add((e as KeyboardEvent).code);
  };

  private readonly onKeyUp = (e: Event): void => {
    this.down.delete((e as KeyboardEvent).code);
  };

  private readonly onBlur = (): void => {
    this.down.clear();
  };
}
