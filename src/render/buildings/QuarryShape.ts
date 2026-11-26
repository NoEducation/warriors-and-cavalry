// The Quarry: an uneven, stepped cut rock face at the back with ledges, a timber scaffold and ladder against it, a
// hoist with a rope and hanging block, a handcart and cut blocks lying in front.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { addLog } from './propParts';
import { ShapeBuilder } from './ShapeBuilder';
import { type BoxSpec, SHAPE_COLORS } from './shapeParts';
import { shadeVariant } from './shadeVariant';

/** The steps of the rock face, from the tall back wall (low z, away from the default camera) to the front. */
const STEPS: readonly BoxSpec[] = [
  { x0: 0.15, z0: 0.15, x1: 2.85, z1: 0.9, y0: 0, y1: 2.0 },
  { x0: 0.3, z0: 0.9, x1: 2.7, z1: 1.5, y0: 0, y1: 1.3 },
  { x0: 0.45, z0: 1.5, x1: 2.4, z1: 2.0, y0: 0, y1: 0.6 },
];
/** Each step is cut into blocks along x; these raise or lower each block's top, so the face looks hewn. */
const BLOCK_TOPS: readonly number[] = [0, 0.14, -0.1, 0.06];
const BLOCK_SALT = 0x91d;

/** Cut blocks lying in front of the face. */
const BLOCKS: readonly BoxSpec[] = [
  { x0: 0.35, z0: 2.25, x1: 0.85, z1: 2.7, y0: 0, y1: 0.4 },
  { x0: 1.0, z0: 2.35, x1: 1.4, z1: 2.75, y0: 0, y1: 0.3 },
  { x0: 0.5, z0: 2.3, x1: 0.8, z1: 2.6, y0: 0.4, y1: 0.65 },
  { x0: 2.45, z0: 1.85, x1: 2.75, z1: 2.2, y0: 0, y1: 0.25 },
];

/** A post, a jib and a brace over the front step; the rope and its block hang from the jib's end. */
const HOIST: readonly BoxSpec[] = [
  { x0: 2.55, z0: 2.4, x1: 2.75, z1: 2.6, y0: 0, y1: 1.7 },
  { x0: 1.95, z0: 2.45, x1: 2.75, z1: 2.55, y0: 1.55, y1: 1.7 },
  { x0: 2.35, z0: 2.46, x1: 2.55, z1: 2.54, y0: 1.3, y1: 1.38 },
];

export class QuarryShape implements BuildingShape {
  /** Creates a new Quarry model (see `BuildingShape.build`). */
  public build(): THREE.Mesh {
    const { width: w, height: d } = OBJECT_KINDS[ObjectKind.Quarry];
    const shape = new ShapeBuilder().addFoundation(w, d, SHAPE_COLORS.darkStone);
    STEPS.forEach((step, i) => this.addStep(shape, step, i));
    BLOCKS.forEach((block, i) => shape.addBox(block, shadeVariant(SHAPE_COLORS.cutStone, BLOCK_SALT, 50 + i, 0.1)));
    for (const part of HOIST) shape.addBox(part, SHAPE_COLORS.timber);
    shape.addBox({ x0: 1.99, x1: 2.03, z0: 2.48, z1: 2.52, y0: 0.95, y1: 1.55 }, SHAPE_COLORS.rope);
    shape.addBox({ x0: 1.89, x1: 2.13, z0: 2.38, z1: 2.62, y0: 0.72, y1: 0.95 }, SHAPE_COLORS.cutStone);
    this.addScaffold(shape);
    this.addCart(shape);
    return shape.build();
  }

  /** One step of the face, cut into blocks of uneven height and shade, with a darker ledge along its front edge. */
  private addStep(shape: ShapeBuilder, step: BoxSpec, index: number): void {
    const base = index % 2 === 0 ? SHAPE_COLORS.cutStone : SHAPE_COLORS.darkCutStone;
    const count = BLOCK_TOPS.length;
    const width = (step.x1 - step.x0) / count;
    for (let b = 0; b < count; b++) {
      const y1 = step.y1 + BLOCK_TOPS[(b + index) % count];
      const block: BoxSpec = { ...step, x0: step.x0 + b * width, x1: step.x0 + (b + 1) * width, y1 };
      shape.addBox(block, shadeVariant(base, BLOCK_SALT, index * count + b, 0.1));
      const ledge: BoxSpec = { ...block, z0: step.z1 - 0.06, y0: y1, y1: y1 + 0.04 };
      shape.addBox(ledge, SHAPE_COLORS.darkStone);
    }
  }

  /** Two poles and a plank platform against the back face, and a ladder up the middle step. */
  private addScaffold(shape: ShapeBuilder): void {
    for (const x of [0.36, 0.86]) {
      shape.addBox({ x0: x, x1: x + 0.06, z0: 0.92, z1: 0.98, y0: 1.1, y1: 2.3 }, SHAPE_COLORS.darkTimber);
    }
    shape.addBox({ x0: 0.3, x1: 1.0, z0: 0.9, z1: 1.2, y0: 1.5, y1: 1.55 }, SHAPE_COLORS.timber);
    for (const x of [0.62, 0.84]) {
      shape.addBox({ x0: x, x1: x + 0.04, z0: 1.5, z1: 1.55, y0: 0.5, y1: 1.55 }, SHAPE_COLORS.timber);
    }
    for (let y = 0.8; y < 1.5; y += 0.16) {
      shape.addBox({ x0: 0.62, x1: 0.88, z0: 1.52, z1: 1.56, y0: y, y1: y + 0.03 }, SHAPE_COLORS.darkTimber);
    }
  }

  /** A handcart in front of the face: a plank bed on two wheels with handles reaching west. */
  private addCart(shape: ShapeBuilder): void {
    shape.addBox({ x0: 1.6, x1: 2.2, z0: 2.3, z1: 2.62, y0: 0.18, y1: 0.32 }, SHAPE_COLORS.timber);
    shape.addBox({ x0: 1.65, x1: 2.0, z0: 2.36, z1: 2.56, y0: 0.32, y1: 0.46 }, SHAPE_COLORS.cutStone);
    for (const z of [2.27, 2.65]) {
      addLog(shape, { x: 1.95, y: 0.14, z, length: 0.04, radius: 0.14, axis: 'z' }, SHAPE_COLORS.darkTimber);
    }
    for (const z of [2.33, 2.55]) {
      shape.addBox({ x0: 1.4, x1: 1.6, z0: z, z1: z + 0.04, y0: 0.26, y1: 0.3 }, SHAPE_COLORS.darkTimber);
    }
  }
}
