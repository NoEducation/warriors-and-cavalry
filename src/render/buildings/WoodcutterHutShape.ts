// The Woodcutter's hut: a framed plank house under a gable roof with a ridge beam, a log pile in front and a chopping
// block with an axe.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { addDoor, addPlinth, addTimberFrame, addWindow } from './detailParts';
import { addChoppingBlock, addLogPile } from './propParts';
import { gableRoofGeometry } from './roofParts';
import { ShapeBuilder } from './ShapeBuilder';
import { type BoxSpec, FOUNDATION_LIFT, SHAPE_COLORS } from './shapeParts';

/** The hut body, set back to leave room in front for the log pile. */
const WALLS: BoxSpec = { x0: 0.3, z0: 0.35, x1: 1.7, z1: 1.2, y0: 0, y1: 0.85 };
const ROOF = { rise: 0.65, overhang: 0.14 } as const;
/** Horizontal plank courses on the walls, and the salt that shades them. */
const PLANKS = 5;
const PLANK_SALT = 0x2b7;

export class WoodcutterHutShape implements BuildingShape {
  /** Creates a new Woodcutter's hut model (see `BuildingShape.build`). */
  public build(): THREE.Mesh {
    const { width: w, height: d } = OBJECT_KINDS[ObjectKind.WoodcutterHut];
    const shape = new ShapeBuilder().addFoundation(w, d);
    shape.addCourses(WALLS, SHAPE_COLORS.timber, PLANKS, PLANK_SALT);
    addPlinth(shape, WALLS, 0.12, 0.03);
    addTimberFrame(shape, WALLS, 0.08);
    addDoor(shape, { wall: WALLS, face: 'south', along: 0.65, bottom: 0.12, width: 0.26, height: 0.53 });
    addWindow(shape, { wall: WALLS, face: 'south', along: 1.32, bottom: 0.42, width: 0.18, height: 0.2 });
    addWindow(shape, { wall: WALLS, face: 'east', along: 0.6, bottom: 0.42, width: 0.16, height: 0.2 });
    shape.add(gableRoofGeometry(WALLS, ROOF.rise, ROOF.overhang), SHAPE_COLORS.hutRoof);
    const ridgeY = WALLS.y1 + ROOF.rise;
    const zc = (WALLS.z0 + WALLS.z1) / 2;
    const ridge: BoxSpec = {
      x0: WALLS.x0 - ROOF.overhang - 0.04,
      x1: WALLS.x1 + ROOF.overhang + 0.04,
      z0: zc - 0.05,
      z1: zc + 0.05,
      y0: ridgeY - 0.05,
      y1: ridgeY + 0.05,
    };
    shape.addBox(ridge, SHAPE_COLORS.darkTimber);
    addLogPile(shape, { x: 0.8, z: d - 0.4, floor: FOUNDATION_LIFT }, 0.95, 0.075, 3, 'x');
    addChoppingBlock(shape, 1.55, d - 0.42, FOUNDATION_LIFT);
    return shape.build();
  }
}
