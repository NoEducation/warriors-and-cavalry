// The common shape of everything WorldView draws for one world: trees, buildings, stockpile stacks and crops.
import type * as THREE from 'three';

/** A part of the scene built for one world; it may follow the world's changes until disposed. */
export interface WorldLayer {
  /** Add this to the scene; the layer manages its children. */
  readonly object: THREE.Object3D;
  /** Brings the drawing in line with the world. Called once per frame; empty for layers that never change per frame. */
  update(): void;
  /** Stops following the world and frees the layer's GPU resources. Call once, after removing `object`. */
  dispose(): void;
}
