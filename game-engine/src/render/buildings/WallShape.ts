// The Wall: a stone block filling its tile, in a dark plinth course, two shaded stone courses and a coping band under
// the walk, with a merlon on each corner so a line of pieces reads as crenellated. Everything is flush with the tile
// so neighbouring pieces join into one wall, and it stays lean because walls are built by the hundred.
import type * as THREE from 'three';
import type { BuildingShape } from './BuildingShape';
import { castleFoundation, cornerMerlons, WALL_SIZES } from './castleParts';
import { ShapeBuilder } from './ShapeBuilder';
import { FOUNDATION_LIFT, SHAPE_COLORS } from './shapeParts';

/** Tops of the plinth course and bottom of the coping band, in world units above the floor. */
const PLINTH_TOP = 0.3;
const COPING = 0.08;
const COURSE_SALT = 0x6a1;

export class WallShape implements BuildingShape {
  /** Creates a new Wall model (see `BuildingShape.build`); it fills the tile with no margin. */
  public build(): THREE.Mesh {
    const { walkHeight, merlonSize, merlonHeight } = WALL_SIZES;
    const tile = { x0: 0, z0: 0, x1: 1, z1: 1 };
    const shape = new ShapeBuilder().addBox(castleFoundation(0, 0, 1, 1), SHAPE_COLORS.foundation);
    shape.addBox({ ...tile, y0: FOUNDATION_LIFT, y1: PLINTH_TOP }, SHAPE_COLORS.darkStone);
    shape.addCourses({ ...tile, y0: PLINTH_TOP, y1: walkHeight - COPING }, SHAPE_COLORS.stone, 2, COURSE_SALT);
    shape.addBox({ ...tile, y0: walkHeight - COPING, y1: walkHeight }, SHAPE_COLORS.darkStone);
    for (const merlon of cornerMerlons(0, 0, 1, 1, merlonSize, walkHeight, walkHeight + merlonHeight)) {
      shape.addBox(merlon, SHAPE_COLORS.stone);
    }
    return shape.build();
  }
}
