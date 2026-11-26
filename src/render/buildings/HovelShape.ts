// The Hovel: a small plastered, timber-framed house on a stone plinth under a layered thatch roof, with a chimney, a
// door and windows, and a log store against its east wall.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { addChimney, addDoor, addPlinth, addTimberFrame, addWindow } from './detailParts';
import { addLogPile } from './propParts';
import { addThatchRoof } from './roofParts';
import { ShapeBuilder } from './ShapeBuilder';
import { type BoxSpec, SHAPE_COLORS } from './shapeParts';

/** The house body. */
const WALLS: BoxSpec = { x0: 0.4, z0: 0.45, x1: 1.6, z1: 1.55, y0: 0, y1: 0.85 };

export class HovelShape implements BuildingShape {
  /** Creates a new Hovel model (see `BuildingShape.build`). */
  public build(): THREE.Mesh {
    const { width: w, height: d } = OBJECT_KINDS[ObjectKind.Hovel];
    const shape = new ShapeBuilder().addFoundation(w, d);
    shape.addBox(WALLS, SHAPE_COLORS.plaster);
    addPlinth(shape, WALLS, 0.14, 0.04);
    addTimberFrame(shape, WALLS, 0.08);
    addDoor(shape, { wall: WALLS, face: 'south', along: 0.72, bottom: 0.14, width: 0.26, height: 0.52 });
    addWindow(shape, { wall: WALLS, face: 'south', along: 1.3, bottom: 0.42, width: 0.18, height: 0.22 });
    addWindow(shape, { wall: WALLS, face: 'east', along: 0.75, bottom: 0.42, width: 0.18, height: 0.22 });
    addWindow(shape, { wall: WALLS, face: 'west', along: 1.0, bottom: 0.42, width: 0.18, height: 0.22 });
    addThatchRoof(shape, WALLS, 0.75, 0.18, SHAPE_COLORS.straw);
    addChimney(shape, 1.2, 0.58, 0.2, WALLS.y1, 1.9);
    this.addLogStore(shape);
    return shape.build();
  }

  /** A small log store against the east wall: logs under a plank roof on two posts. */
  private addLogStore(shape: ShapeBuilder): void {
    const [z0, z1] = [1.08, 1.5];
    addLogPile(shape, { x: 1.76, z: (z0 + z1) / 2, floor: 0.1 }, z1 - z0 - 0.04, 0.055, 2, 'z');
    for (const z of [z0, z1 - 0.06]) {
      shape.addBox({ x0: 1.84, x1: 1.9, z0: z, z1: z + 0.06, y0: 0, y1: 0.42 }, SHAPE_COLORS.darkTimber);
    }
    shape.addBox({ x0: 1.6, x1: 1.94, z0: z0 - 0.04, z1: z1 + 0.04, y0: 0.42, y1: 0.47 }, SHAPE_COLORS.timber);
  }
}
