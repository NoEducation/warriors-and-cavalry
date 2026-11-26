// The Wall: a stone block filling its tile, with a merlon on each corner so a line of pieces reads as crenellated.
import type * as THREE from 'three';
import type { BuildingShape } from './BuildingShape';
import { castleFoundation, cornerMerlons, WALL_SIZES } from './castleParts';
import { ShapeBuilder } from './ShapeBuilder';
import { FOUNDATION_LIFT, SHAPE_COLORS } from './shapeParts';

export class WallShape implements BuildingShape {
  /** Creates a new Wall model (see `BuildingShape.build`); it fills the tile with no margin. */
  public build(): THREE.Mesh {
    const { walkHeight, merlonSize, merlonHeight } = WALL_SIZES;
    const shape = new ShapeBuilder().addBox(castleFoundation(0, 0, 1, 1), SHAPE_COLORS.foundation);
    shape.addBox({ x0: 0, z0: 0, x1: 1, z1: 1, y0: FOUNDATION_LIFT, y1: walkHeight }, SHAPE_COLORS.stone);
    for (const merlon of cornerMerlons(0, 0, 1, 1, merlonSize, walkHeight, walkHeight + merlonHeight)) {
      shape.addBox(merlon, SHAPE_COLORS.stone);
    }
    return shape.build();
  }
}
