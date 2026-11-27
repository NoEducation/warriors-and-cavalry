// The Barracks: a long stone hall on a plinth under a gabled timber roof, with arrow slits, a door, a weapon rack of
// spears and a straw target in its yard, and a banner.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { addBanner } from './castleParts';
import { addArrowSlit, addDoor, addPlinth } from './detailParts';
import { gableRoofGeometry } from './roofParts';
import { ShapeBuilder } from './ShapeBuilder';
import { type BoxSpec, SHAPE_COLORS } from './shapeParts';

/** The hall's stone walls, along x on the north half of the footprint. */
const HALL: BoxSpec = { x0: 0.35, z0: 0.35, x1: 2.65, z1: 1.55, y0: 0, y1: 0.95 };

export class BarracksShape implements BuildingShape {
  /** Creates a new Barracks model (see `BuildingShape.build`). */
  public build(): THREE.Mesh {
    const { width: w, height: d } = OBJECT_KINDS[ObjectKind.Barracks];
    const shape = new ShapeBuilder().addFoundation(w, d);
    shape.addCourses(HALL, SHAPE_COLORS.stone, 4, 14);
    addPlinth(shape, HALL, 0.16, 0.04);
    shape.add(gableRoofGeometry(HALL, 0.55, 0.12), SHAPE_COLORS.hutRoof);
    addDoor(shape, { wall: HALL, face: 'south', along: 1.5, bottom: 0.16, width: 0.32, height: 0.6 });
    for (const along of [0.6, 1.0, 2.0, 2.4]) {
      addArrowSlit(shape, { wall: HALL, face: 'south', along, bottom: 0.4, width: 0.06, height: 0.3 });
    }
    for (const along of [0.5, 0.9]) addArrowSlit(shape, { wall: HALL, face: 'west', along, bottom: 0.4, width: 0.06, height: 0.3 });
    this.addRack(shape);
    this.addTarget(shape);
    addBanner(shape, 2.55, 1.75, 0, 1.6);
    return shape.build();
  }

  /** A rack of three spears leaning on a rail in the yard, west of the door. */
  private addRack(shape: ShapeBuilder): void {
    shape.addBox({ x0: 0.45, x1: 1.15, z0: 2.1, z1: 2.16, y0: 0.4, y1: 0.46 }, SHAPE_COLORS.darkTimber);
    for (const x of [0.45, 1.09]) shape.addBox({ x0: x, x1: x + 0.06, z0: 2.1, z1: 2.16, y0: 0, y1: 0.46 }, SHAPE_COLORS.darkTimber);
    for (const x of [0.6, 0.8, 1.0]) {
      shape.addBox({ x0: x, x1: x + 0.03, z0: 2.0, z1: 2.03, y0: 0, y1: 0.85 }, SHAPE_COLORS.timber);
      shape.addBox({ x0: x - 0.01, x1: x + 0.04, z0: 1.995, z1: 2.035, y0: 0.85, y1: 0.95 }, SHAPE_COLORS.darkStone);
    }
  }

  /** A straw archery target on a post in the yard, east of the door. */
  private addTarget(shape: ShapeBuilder): void {
    shape.addBox({ x0: 2.17, x1: 2.23, z0: 2.3, z1: 2.36, y0: 0, y1: 0.4 }, SHAPE_COLORS.darkTimber);
    shape.addBox({ x0: 2.0, x1: 2.4, z0: 2.24, z1: 2.3, y0: 0.3, y1: 0.7 }, SHAPE_COLORS.straw);
    shape.addBox({ x0: 2.15, x1: 2.25, z0: 2.22, z1: 2.24, y0: 0.45, y1: 0.55 }, SHAPE_COLORS.banner);
  }
}
