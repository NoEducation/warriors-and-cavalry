// What Game is given from outside: the page elements it uses and where its worlds come from.
import type { LoadedWorld } from './WorldAssembler';

/** The page elements the game draws into and builds its widgets in. */
export interface GameElements {
  readonly canvas: HTMLCanvasElement;
  readonly hudRoot: HTMLElement;
  readonly resourceRoot: HTMLElement;
  readonly buildBarRoot: HTMLElement;
}

/**
 * Loads the world for `seed` (showing progress meanwhile) and passes it to `show`; resolves once the load is over,
 * whether it worked or not.
 */
export type WorldSource = (seed: number, show: (loaded: LoadedWorld) => void) => Promise<void>;
