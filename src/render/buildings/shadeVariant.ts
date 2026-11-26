// Slight, fixed brightness variations of a building colour, so stone courses, planks and blocks read as separate pieces.
import * as THREE from 'three';
import { hash2 } from '../../sim/rng';

/** Building detail tuning. Tune by editing these values. */
export const BUILDING_DETAIL_CONFIG = Object.freeze({
  /** Largest brightness change of a shade variant, as a fraction of the base colour. */
  shadeSwing: 0.07,
});

const tmp = new THREE.Color();

/**
 * `color` brightened or darkened by up to `swing`, by a hash of `salt` and `index`, as an sRGB hex colour. The same
 * arguments always give the same shade, so every building of a kind looks alike. Call once per part.
 */
export function shadeVariant(
  color: number,
  salt: number,
  index: number,
  swing: number = BUILDING_DETAIL_CONFIG.shadeSwing,
): number {
  return tmp.set(color).multiplyScalar(1 + swing * (2 * hash2(salt, index, 0) - 1)).getHex();
}
