// The Gate: a wall piece with an arched opening through it, turned to run across the wall it stands in.
import type * as THREE from 'three';
import type { BuildingShape } from './BuildingShape';
import { castleFoundation, cornerMerlons, WALL_SIZES } from './castleParts';
import { ShapeBuilder } from './ShapeBuilder';
import { type BoxSpec, FOUNDATION_LIFT, SHAPE_COLORS } from './shapeParts';

/** Which way walkers pass through a gate: along z (north–south) or along x (east–west). */
export type GatePassage = 'northSouth' | 'eastWest';

/** `spec` mirrored across the tile's diagonal (x and z swapped), turning an east–west part north–south. */
function turned(spec: BoxSpec): BoxSpec {
  return { x0: spec.z0, z0: spec.x0, x1: spec.z1, z1: spec.x1, y0: spec.y0, y1: spec.y1 };
}

export class GateShape implements BuildingShape {
  /**
   * Creates a new Gate model (see `BuildingShape.build`) whose opening runs along `passage`; it fills the tile with no
   * margin, like a Wall.
   */
  public build(passage: GatePassage = 'eastWest'): THREE.Mesh {
    const { walkHeight, merlonSize, merlonHeight, openingWidth, openingHeight, archStep } = WALL_SIZES;
    const side = (1 - openingWidth) / 2;
    const lift = FOUNDATION_LIFT;
    // Parts of an east–west gate: the opening runs along x, between two piers at the low and high z edges.
    const stone: BoxSpec[] = [
      { x0: 0, z0: 0, x1: 1, z1: side, y0: lift, y1: walkHeight },
      { x0: 0, z0: 1 - side, x1: 1, z1: 1, y0: lift, y1: walkHeight },
      { x0: 0, z0: side, x1: 1, z1: 1 - side, y0: openingHeight, y1: walkHeight },
      { x0: 0, z0: side, x1: 1, z1: side + archStep, y0: openingHeight - archStep, y1: openingHeight },
      { x0: 0, z0: 1 - side - archStep, x1: 1, z1: 1 - side, y0: openingHeight - archStep, y1: openingHeight },
      ...cornerMerlons(0, 0, 1, 1, merlonSize, walkHeight, walkHeight + merlonHeight),
    ];
    const place = passage === 'eastWest' ? (spec: BoxSpec): BoxSpec => spec : turned;
    const shape = new ShapeBuilder().addBox(castleFoundation(0, 0, 1, 1), SHAPE_COLORS.foundation);
    for (const spec of stone) shape.addBox(place(spec), SHAPE_COLORS.stone);
    return shape.build();
  }
}
