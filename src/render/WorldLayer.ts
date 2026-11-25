// The common shape of everything WorldView draws for one world: trees, buildings, stockpile stacks, crops and peasants.
import type * as THREE from 'three';

/** A part of the scene built for one world; it may follow the world's changes until disposed. */
export interface WorldLayer {
  /** Add this to the scene; the layer manages its children. */
  readonly object: THREE.Object3D;
  /**
   * Brings the drawing in line with the world, `tickFraction` (in [0, 1)) of a tick past the last simulation tick.
   * Called once per frame; empty for layers that never change per frame. Layers that do not move between ticks may
   * leave the parameter out.
   */
  update(tickFraction: number): void;
  /** Stops following the world and frees the layer's GPU resources. Call once, after removing `object`. */
  dispose(): void;
}
