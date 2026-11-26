// The Granary: a raised timber store standing on four posts, under a pitched straw roof.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { ShapeBuilder } from './ShapeBuilder';
import { gableRoofGeometry } from './roofParts';
import { type BoxSpec, SHAPE_COLORS } from './shapeParts';

/** Height of the store's floor above the building's floor. */
const STILT_HEIGHT = 0.6;
const POST_SIZE = 0.26;

export class GranaryShape implements BuildingShape {
  /** Creates a new Granary model (see `BuildingShape.build`). */
  public build(): THREE.Mesh {
    const { width: w, height: d } = OBJECT_KINDS[ObjectKind.Granary];
    const shape = new ShapeBuilder().addFoundation(w, d);
    const post = 0.5;
    for (const x of [post, w - post - POST_SIZE]) {
      for (const z of [post, d - post - POST_SIZE]) {
        const spec: BoxSpec = { x0: x, z0: z, x1: x + POST_SIZE, z1: z + POST_SIZE, y0: 0, y1: STILT_HEIGHT };
        shape.addBox(spec, SHAPE_COLORS.darkTimber);
      }
    }
    const sillTop = STILT_HEIGHT + 0.05;
    const sill: BoxSpec = { x0: 0.3, z0: 0.4, x1: w - 0.3, z1: d - 0.4, y0: STILT_HEIGHT - 0.1, y1: sillTop };
    shape.addBox(sill, SHAPE_COLORS.darkTimber);
    const store: BoxSpec = { x0: 0.4, z0: 0.5, x1: w - 0.4, z1: d - 0.5, y0: STILT_HEIGHT, y1: STILT_HEIGHT + 1.1 };
    shape.addBox(store, SHAPE_COLORS.timber);
    shape.add(gableRoofGeometry(store, 0.95, 0.2), SHAPE_COLORS.straw);
    return shape.build();
  }
}
