// How a tree is drawn as rounds of wood are taken from it: smaller with each round, and its shadow with it.
import * as THREE from 'three';
import type { TreeSlot } from './TreeShadowLayer';

/** Tree stage tuning. Frozen; tune by editing the values here. */
export const TREE_STAGE_CONFIG = Object.freeze({
  /** Size of a tree (and its shadow) by rounds already taken from it, as a share of its full size. */
  scales: Object.freeze([1, 0.85, 0.7, 0.55]),
});

const stretch = new THREE.Matrix4();
const matrix = new THREE.Matrix4();

/** The share of its full size a tree is drawn at once `chopsTaken` rounds have been taken; the last scale beyond. */
export function stageScale(chopsTaken: number): number {
  const { scales } = TREE_STAGE_CONFIG;
  return scales[Math.max(0, Math.min(scales.length - 1, chopsTaken))];
}

/**
 * Rescales the instance in `slot` from the size of stage `from` to that of stage `to`, about the instance's own origin
 * (a tree's base, a shadow's centre). With `flat`, the local y axis is left alone (a shadow disc). Call when a
 * `chopped` change is drawn, with the stage drawn so far and the tree's rounds taken now.
 */
export function shrinkToStage(slot: TreeSlot, from: number, to: number, flat: boolean): void {
  const ratio = stageScale(to) / stageScale(from);
  slot.mesh.getMatrixAt(slot.index, matrix);
  matrix.multiply(stretch.makeScale(ratio, flat ? 1 : ratio, ratio));
  slot.mesh.setMatrixAt(slot.index, matrix);
  slot.mesh.instanceMatrix.needsUpdate = true;
}
