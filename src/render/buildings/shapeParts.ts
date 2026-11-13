// Building blocks shared by the building shapes: colours, foundation and simple flat-shaded meshes.
import * as THREE from 'three';

/** Gap left between a building and the edge of its footprint, in world units. */
export const FOOTPRINT_MARGIN = 0.15;
/** The foundation reaches this far below the floor so buildings never float on the steepest allowed ground. */
export const FOUNDATION_DEPTH = 1.5;
/** The foundation shows this far above the floor. */
export const FOUNDATION_LIFT = 0.1;

export const SHAPE_COLORS = {
  foundation: 0x6e6a60,
  timber: 0x8a6a45,
  darkTimber: 0x7a5a3a,
  straw: 0xc9b458,
  stone: 0x9a9a94,
  darkStone: 0x6f6f6a,
  bareEarth: 0x7b5b3a,
  hutRoof: 0x4a3a2a,
  logs: 0x6b4a2b,
  cropGreen: 0x6aa84f,
  cropGold: 0xd9b93a,
} as const;

/** An axis-aligned box in a building's local coordinates. */
export interface BoxSpec {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
  readonly y0: number;
  readonly y1: number;
}

/** A flat-shaded Lambert mesh of `geometry` in `color`. */
export function flatMesh(geometry: THREE.BufferGeometry, color: number): THREE.Mesh {
  return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color, flatShading: true }));
}

/** A box mesh filling `spec`. */
export function boxMesh(spec: BoxSpec, color: number): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(spec.x1 - spec.x0, spec.y1 - spec.y0, spec.z1 - spec.z0);
  geometry.translate((spec.x0 + spec.x1) / 2, (spec.y0 + spec.y1) / 2, (spec.z0 + spec.z1) / 2);
  return flatMesh(geometry, color);
}

/** A new group holding the foundation of a `w` x `d` footprint, showing `lift` above the floor. */
export function groupWithFoundation(
  w: number,
  d: number,
  color: number = SHAPE_COLORS.foundation,
  lift: number = FOUNDATION_LIFT,
): THREE.Group {
  const m = FOOTPRINT_MARGIN;
  const group = new THREE.Group();
  group.add(boxMesh({ x0: m, z0: m, x1: w - m, z1: d - m, y0: -FOUNDATION_DEPTH, y1: lift }, color));
  return group;
}

/**
 * A gable roof resting on top of the wall box `spec` (at y1), ridge along x, rising by `rise`; it overhangs the walls
 * by `overhang` on every side.
 */
export function gableRoof(spec: BoxSpec, rise: number, overhang: number, color: number): THREE.Mesh {
  const halfSpan = (spec.z1 - spec.z0) / 2 + overhang;
  const shape = new THREE.Shape();
  shape.moveTo(-halfSpan, 0);
  shape.lineTo(halfSpan, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  const roof = new THREE.ExtrudeGeometry(shape, { depth: spec.x1 - spec.x0 + 2 * overhang, bevelEnabled: false });
  roof.rotateY(Math.PI / 2); // shape x -> -z, extrusion z -> x
  roof.translate(spec.x0 - overhang, spec.y1, (spec.z0 + spec.z1) / 2);
  return flatMesh(roof, color);
}
