// The Quarry: a stepped cut rock face at the back, loose blocks and a timber hoist in front.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { type BoxSpec, boxMesh, groupWithFoundation, SHAPE_COLORS } from './shapeParts';

/** The steps of the rock face, from the tall back wall (low z, away from the default camera) to the front. */
const STEPS: readonly BoxSpec[] = [
  { x0: 0.15, z0: 0.15, x1: 2.85, z1: 0.9, y0: 0, y1: 2.0 },
  { x0: 0.3, z0: 0.9, x1: 2.7, z1: 1.5, y0: 0, y1: 1.3 },
  { x0: 0.45, z0: 1.5, x1: 2.4, z1: 2.0, y0: 0, y1: 0.6 },
];

/** Cut blocks lying in front of the face. */
const BLOCKS: readonly BoxSpec[] = [
  { x0: 0.35, z0: 2.25, x1: 0.85, z1: 2.7, y0: 0, y1: 0.4 },
  { x0: 1.0, z0: 2.35, x1: 1.4, z1: 2.75, y0: 0, y1: 0.3 },
  { x0: 0.5, z0: 2.3, x1: 0.8, z1: 2.6, y0: 0.4, y1: 0.65 },
];

/** A post and a jib over the front step. */
const HOIST: readonly BoxSpec[] = [
  { x0: 2.55, z0: 2.4, x1: 2.75, z1: 2.6, y0: 0, y1: 1.7 },
  { x0: 2.0, z0: 2.45, x1: 2.75, z1: 2.55, y0: 1.55, y1: 1.7 },
];

export class QuarryShape implements BuildingShape {
  /** Creates a new Quarry model (see `BuildingShape.build`). */
  public build(): THREE.Group {
    const { width: w, height: d } = OBJECT_KINDS[ObjectKind.Quarry];
    const group = groupWithFoundation(w, d, SHAPE_COLORS.darkStone);
    STEPS.forEach((step, i) => group.add(boxMesh(step, i % 2 === 0 ? SHAPE_COLORS.stone : SHAPE_COLORS.darkStone)));
    for (const block of BLOCKS) group.add(boxMesh(block, SHAPE_COLORS.stone));
    for (const part of HOIST) group.add(boxMesh(part, SHAPE_COLORS.timber));
    return group;
  }
}
