// Building blocks shared by the building shapes: colours, sizes and simple geometries in building-local coordinates.
import * as THREE from 'three';

/** Gap left between a building and the edge of its footprint, in world units. */
export const FOOTPRINT_MARGIN = 0.15;
/** The foundation reaches this far below the floor so buildings never float on the steepest allowed ground. */
export const FOUNDATION_DEPTH = 1.5;
/** The foundation shows this far above the floor. */
export const FOUNDATION_LIFT = 0.1;

export const SHAPE_COLORS = {
  // Weathered, sooty materials: grey-brown timber, rotting thatch, cold stone, dirty plaster.
  foundation: 0x57534b,
  timber: 0x6b5236,
  darkTimber: 0x57422e,
  straw: 0x8f7c48,
  stone: 0x7b7973,
  darkStone: 0x56554f,
  /** Freshly cut quarry stone: warmer and lighter than the grey Rock terrain it is dug from. */
  cutStone: 0xaa9c7e,
  darkCutStone: 0x8c7d62,
  bareEarth: 0x5a432d,
  hutRoof: 0x372b20,
  logs: 0x553b23,
  cropGreen: 0x5f6c34,
  cropGold: 0xa8842c,
  door: 0x3a281a,
  shutter: 0x46533a,
  windowDark: 0x1a1612,
  ridge: 0x695a2e,
  banner: 0x7e1f1b,
  rope: 0x8e7a55,
  plaster: 0xaea58c,
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

/** A new box geometry filling `spec`. */
export function boxGeometry(spec: BoxSpec): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(spec.x1 - spec.x0, spec.y1 - spec.y0, spec.z1 - spec.z0);
  return geometry.translate((spec.x0 + spec.x1) / 2, (spec.y0 + spec.y1) / 2, (spec.z0 + spec.z1) / 2);
}
