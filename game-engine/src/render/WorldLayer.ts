// The common shape of everything WorldView draws for one world: trees, buildings, stockpile stacks, crops and peasants.
import type * as THREE from 'three';
import type { World } from '../sim/World';

/**
 * A part of the scene built for one world; it may follow the world's changes until disposed. It keeps no reference to
 * the world: `Game` passes it to every `update`.
 */
export interface WorldLayer {
  /** Add this to the scene; the layer manages its children. */
  readonly object: THREE.Object3D;
  /**
   * Brings the drawing in line with `world` (the one the layer was built for), `tickFraction` (in [0, 1)) of a tick
   * past the last simulation tick. Called once per frame; empty for layers that never change per frame. Layers may
   * leave out the parameters they do not need.
   */
  update(world: World, tickFraction: number): void;
  /** Stops following the world and frees the layer's GPU resources. Call once, after removing `object`. */
  dispose(): void;
}
