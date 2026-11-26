// The Granary: a plank store raised on braced posts under a layered straw roof, with battens, a door reached by steps,
// a vent under the gable and grain sacks waiting by the steps.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { addArrowSlit, addDoor } from './detailParts';
import { addSack } from './propParts';
import { addThatchRoof } from './roofParts';
import { ShapeBuilder } from './ShapeBuilder';
import { type BoxSpec, FOUNDATION_LIFT, SHAPE_COLORS } from './shapeParts';

/** Height of the store's floor above the building's floor. */
const STILT_HEIGHT = 0.6;
const POST_SIZE = 0.26;
const POST_INSET = 0.5;
const STEPS = 4;
const BATTEN = { width: 0.05, depth: 0.03, spacing: 0.36 } as const;
const PLANK_SALT = 0x3c1;

export class GranaryShape implements BuildingShape {
  /** Creates a new Granary model (see `BuildingShape.build`). */
  public build(): THREE.Mesh {
    const { width: w, height: d } = OBJECT_KINDS[ObjectKind.Granary];
    const shape = new ShapeBuilder().addFoundation(w, d);
    this.addStilts(shape, w, d);
    const sill: BoxSpec = { x0: 0.3, z0: 0.4, x1: w - 0.3, z1: d - 0.4, y0: STILT_HEIGHT - 0.1, y1: STILT_HEIGHT + 0.05 };
    shape.addBox(sill, SHAPE_COLORS.darkTimber);
    const store: BoxSpec = { x0: 0.4, z0: 0.5, x1: w - 0.4, z1: d - 0.5, y0: STILT_HEIGHT, y1: STILT_HEIGHT + 1.1 };
    shape.addCourses(store, SHAPE_COLORS.timber, 4, PLANK_SALT);
    this.addBattens(shape, store);
    addDoor(shape, { wall: store, face: 'south', along: w / 2, bottom: sill.y1, width: 0.4, height: 0.68 });
    for (const face of ['east', 'west'] as const) {
      addArrowSlit(shape, { wall: store, face, along: d / 2, bottom: store.y1 - 0.35, width: 0.3, height: 0.14 });
    }
    addThatchRoof(shape, store, 0.95, 0.2, SHAPE_COLORS.straw);
    this.addSteps(shape, w / 2, store.z1, sill.y1);
    for (const [x, z] of [[0.6, d - 0.3], [0.86, d - 0.26], [w - 0.6, d - 0.3]] as const) {
      addSack(shape, x, z, FOUNDATION_LIFT);
    }
    return shape.build();
  }

  /** Four posts joined by rails at mid-height along the front and back. */
  private addStilts(shape: ShapeBuilder, w: number, d: number): void {
    const xs = [POST_INSET, w - POST_INSET - POST_SIZE];
    const zs = [POST_INSET, d - POST_INSET - POST_SIZE];
    for (const x of xs) {
      for (const z of zs) {
        shape.addBox({ x0: x, z0: z, x1: x + POST_SIZE, z1: z + POST_SIZE, y0: 0, y1: STILT_HEIGHT }, SHAPE_COLORS.darkTimber);
      }
    }
    for (const z of zs) {
      const rail: BoxSpec = { x0: xs[0], x1: xs[1] + POST_SIZE, z0: z + 0.08, z1: z + 0.18, y0: 0.22, y1: 0.3 };
      shape.addBox(rail, SHAPE_COLORS.timber);
    }
  }

  /** Dark vertical battens over the plank joints on the front and east walls. */
  private addBattens(shape: ShapeBuilder, store: BoxSpec): void {
    const { width: bw, depth, spacing } = BATTEN;
    for (let x = store.x0 + spacing; x < store.x1 - bw; x += spacing) {
      if (Math.abs(x - (store.x0 + store.x1) / 2) < 0.3) continue; // leave the door clear
      shape.addBox({ ...store, x0: x - bw / 2, x1: x + bw / 2, z0: store.z1, z1: store.z1 + depth }, SHAPE_COLORS.darkTimber);
    }
    for (let z = store.z0 + spacing; z < store.z1 - bw; z += spacing) {
      shape.addBox({ ...store, x0: store.x1, x1: store.x1 + depth, z0: z - bw / 2, z1: z + bw / 2 }, SHAPE_COLORS.darkTimber);
    }
  }

  /** Steps from the ground up to the door sill at `top`, in front of the store's front wall at z = `z0`. */
  private addSteps(shape: ShapeBuilder, x: number, z0: number, top: number): void {
    const depth = 0.1;
    for (let k = 0; k < STEPS; k++) {
      const y1 = (top * (STEPS - k)) / STEPS;
      const spec: BoxSpec = { x0: x - 0.24, x1: x + 0.24, z0: z0 + k * depth, z1: z0 + (k + 1) * depth, y0: 0, y1 };
      shape.addBox(spec, k % 2 === 0 ? SHAPE_COLORS.timber : SHAPE_COLORS.darkTimber);
    }
  }
}
