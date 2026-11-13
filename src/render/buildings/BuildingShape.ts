// The common contract of every building shape.
import type * as THREE from 'three';

/** Builds the low-poly model of one building kind. */
export interface BuildingShape {
  /**
   * Creates a new group: origin at the footprint's lowest-coordinate corner, floor at y = 0, a foundation reaching
   * `FOUNDATION_DEPTH` below the floor. The caller owns the result and disposes it.
   */
  build(): THREE.Group;
}
