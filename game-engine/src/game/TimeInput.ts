// Player input for game time: Space pauses and resumes, + and - step the simulation speed (without Ctrl, Meta or Alt).
import type { SimulationRunner } from './SimulationRunner';

const PAUSE_KEYS: readonly string[] = ['Space'];
const FASTER_KEYS: readonly string[] = ['Equal', 'NumpadAdd'];
const SLOWER_KEYS: readonly string[] = ['Minus', 'NumpadSubtract'];

export class TimeInput {
  /** Listens for keys on `target` (usually `window`) and drives `runner`. Create once at setup. */
  public constructor(
    private readonly target: EventTarget,
    private readonly runner: SimulationRunner,
  ) {
    target.addEventListener('keydown', this.onKeyDown);
  }

  /** Stops listening for keys. */
  public dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
  }

  private readonly onKeyDown = (e: Event): void => {
    const { code, repeat, ctrlKey, metaKey, altKey } = e as KeyboardEvent;
    // Leave shortcuts such as Ctrl+- (browser zoom) to the browser.
    if (ctrlKey || metaKey || altKey) return;
    const action = this.actionFor(code);
    if (!action) return;
    // Prevent even repeats, so a held Space never scrolls the page or presses a focused button.
    e.preventDefault();
    if (!repeat) action();
  };

  private actionFor(code: string): (() => void) | null {
    if (PAUSE_KEYS.includes(code)) return () => this.runner.togglePause();
    if (FASTER_KEYS.includes(code)) return () => this.runner.faster();
    if (SLOWER_KEYS.includes(code)) return () => this.runner.slower();
    return null;
  }
}
