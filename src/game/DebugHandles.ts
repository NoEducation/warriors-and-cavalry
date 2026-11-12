// The handles Game exposes on `window.__debug` in dev builds, for the browser console.
import type * as THREE from 'three';
import type { World } from '../sim/World';
import type { Game } from './Game';
import type { SimulationRunner } from './SimulationRunner';

/** Handles exposed on `window.__debug` in dev builds, for the browser console. */
export interface DebugHandles {
  readonly renderer: THREE.WebGLRenderer;
  readonly game: Game;
  /** The world currently shown; changes when a new map is loaded. */
  readonly world: World;
  /** Turns frame time into ticks; pause it to step the world by hand with `world.tick()`. */
  readonly runner: SimulationRunner;
}

declare global {
  interface Window {
    __debug?: DebugHandles;
  }
}
