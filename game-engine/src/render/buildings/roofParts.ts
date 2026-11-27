// Roofs for the building shapes: gable, lean-to and pyramid geometries, and a layered thatch roof with a ridge cap.
import * as THREE from 'three';
import type { ShapeBuilder } from './ShapeBuilder';
import { type BoxSpec, SHAPE_COLORS } from './shapeParts';
import { shadeVariant } from './shadeVariant';

/** Thatch layering: share of the rise where the upper layer starts, its lift off the lower one, and the ridge cap. */
const THATCH = { upperFrom: 0.45, lift: 0.06, capHalfWidth: 0.07, capHeight: 0.07, darken: 0.12, salt: 0x7c3 } as const;

/** A (z, y) point of a roof profile. */
type ProfilePoint = readonly [number, number];

/** A prism along x from `x0` to `x1` whose cross-section is the (z, y) `profile`, lifted to base height `y`. */
function prism(x0: number, x1: number, profile: readonly ProfilePoint[], y: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Shape x becomes -z after the turn below, so it is negated here to keep +z as +z.
  profile.forEach(([z, py], i) => (i === 0 ? shape.moveTo(-z, py) : shape.lineTo(-z, py)));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false });
  geometry.rotateY(Math.PI / 2); // shape x -> -z, extrusion z -> x
  return geometry.translate(x0, y, 0);
}

/**
 * A new gable roof geometry resting on top of the wall box `spec` (at y1), ridge along x, rising by `rise`; it
 * overhangs the walls by `overhang` on every side.
 */
export function gableRoofGeometry(spec: BoxSpec, rise: number, overhang: number): THREE.BufferGeometry {
  const half = (spec.z1 - spec.z0) / 2 + overhang;
  const zc = (spec.z0 + spec.z1) / 2;
  const profile: ProfilePoint[] = [[zc - half, 0], [zc + half, 0], [zc, rise]];
  return prism(spec.x0 - overhang, spec.x1 + overhang, profile, spec.y1);
}

/** A new lean-to roof geometry on top of `spec`: high (by `rise`) at the low-z edge, sloping down to the high-z edge. */
export function leanToRoofGeometry(spec: BoxSpec, rise: number, overhang: number): THREE.BufferGeometry {
  const [z0, z1] = [spec.z0 - overhang, spec.z1 + overhang];
  return prism(spec.x0 - overhang, spec.x1 + overhang, [[z0, 0], [z1, 0], [z0, rise]], spec.y1);
}

/** A new four-sided pyramid roof geometry on top of `spec`, rising by `rise` and overhanging by `overhang`. */
export function pyramidRoofGeometry(spec: BoxSpec, rise: number, overhang: number): THREE.BufferGeometry {
  const roof = new THREE.ConeGeometry(Math.SQRT1_2, rise, 4);
  roof.rotateY(Math.PI / 4); // edges parallel to the walls, base side 1
  roof.scale(spec.x1 - spec.x0 + 2 * overhang, 1, spec.z1 - spec.z0 + 2 * overhang);
  return roof.translate((spec.x0 + spec.x1) / 2, spec.y1 + rise / 2, (spec.z0 + spec.z1) / 2);
}

/**
 * Adds a thatch gable roof over `spec`: a full lower layer in `color`, a smaller upper layer a shade darker standing
 * just proud of it, and a ridge cap along the top.
 */
export function addThatchRoof(shape: ShapeBuilder, spec: BoxSpec, rise: number, overhang: number, color: number): void {
  shape.add(gableRoofGeometry(spec, rise, overhang), color);
  const t = THATCH.upperFrom;
  const half = ((spec.z1 - spec.z0) / 2 + overhang) * (1 - t);
  const zc = (spec.z0 + spec.z1) / 2;
  const base = spec.y1 + t * rise + THATCH.lift;
  const profile: ProfilePoint[] = [[zc - half, 0], [zc + half, 0], [zc, rise * (1 - t)]];
  const upper = prism(spec.x0 - overhang * 0.6, spec.x1 + overhang * 0.6, profile, base);
  shape.add(upper, shadeVariant(color, THATCH.salt, 0, THATCH.darken));
  const top = spec.y1 + rise + THATCH.lift;
  const cap = THATCH.capHalfWidth;
  const x0 = spec.x0 - overhang;
  const x1 = spec.x1 + overhang;
  shape.addBox({ x0, x1, z0: zc - cap, z1: zc + cap, y0: top - 0.05, y1: top + THATCH.capHeight }, SHAPE_COLORS.ridge);
}
