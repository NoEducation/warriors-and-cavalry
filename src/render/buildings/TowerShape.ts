// The Tower: a tall square stone tower over its 2 x 2 footprint, ringed by a parapet band and chunky merlons.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { castleFoundation, cornerMerlons } from './castleParts';
import { ShapeBuilder } from './ShapeBuilder';
import { FOUNDATION_LIFT, SHAPE_COLORS } from './shapeParts';

/** Tower sizes, in world units. */
const TOWER_SIZES = {
  /** Gap between the parapet and the footprint edge. */
  margin: 0.1,
  /** How far the shaft is set back under the parapet band. */
  shaftInset: 0.1,
  /** Bottom and top of the darker parapet band; the merlons stand on its top. */
  bandBottom: 2.3,
  bandTop: 2.55,
  merlonSize: 0.4,
  merlonHeight: 0.45,
} as const;

export class TowerShape implements BuildingShape {
  /** Creates a new Tower model (see `BuildingShape.build`). */
  public build(): THREE.Mesh {
    const { width: w, height: d } = OBJECT_KINDS[ObjectKind.Tower];
    const { margin: m, shaftInset, bandBottom, bandTop, merlonSize: size, merlonHeight } = TOWER_SIZES;
    const shape = new ShapeBuilder().addBox(castleFoundation(m, m, w - m, d - m), SHAPE_COLORS.foundation);
    const s = m + shaftInset;
    shape.addBox({ x0: s, z0: s, x1: w - s, z1: d - s, y0: FOUNDATION_LIFT, y1: bandBottom }, SHAPE_COLORS.stone);
    shape.addBox({ x0: m, z0: m, x1: w - m, z1: d - m, y0: bandBottom, y1: bandTop }, SHAPE_COLORS.darkStone);
    const top = bandTop + merlonHeight;
    const merlons = cornerMerlons(m, m, w - m, d - m, size, bandTop, top);
    // One more merlon in the middle of each side.
    const [x0, x1] = [(w - size) / 2, (w + size) / 2];
    const [z0, z1] = [(d - size) / 2, (d + size) / 2];
    merlons.push(
      { x0, z0: m, x1, z1: m + size, y0: bandTop, y1: top },
      { x0, z0: d - m - size, x1, z1: d - m, y0: bandTop, y1: top },
      { x0: m, z0, x1: m + size, z1, y0: bandTop, y1: top },
      { x0: w - m - size, z0, x1: w - m, z1, y0: bandTop, y1: top },
    );
    for (const merlon of merlons) shape.addBox(merlon, SHAPE_COLORS.stone);
    return shape.build();
  }
}
