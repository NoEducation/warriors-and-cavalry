// The Tower: a tall square stone tower over its 2 x 2 footprint on a battered plinth, its shaft in shaded courses with
// arrow slits and a door, corbels carrying a parapet band, chunky merlons and a banner.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { addBanner, castleFoundation, cornerMerlons } from './castleParts';
import { addArrowSlit, addDoor, addPlinth, type WallFace } from './detailParts';
import { ShapeBuilder } from './ShapeBuilder';
import { type BoxSpec, FOUNDATION_LIFT, SHAPE_COLORS } from './shapeParts';

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
  /** Corbels under the band: their size and spacing along each side. */
  corbel: 0.1,
  corbelSpacing: 0.3,
} as const;
const COURSE_SALT = 0x7b1;

/** Height above the floor of the parapet top a walker on the tower stands on. */
export const TOWER_TOP = TOWER_SIZES.bandTop;

export class TowerShape implements BuildingShape {
  /** Creates a new Tower model (see `BuildingShape.build`). */
  public build(): THREE.Mesh {
    const { width: w, height: d } = OBJECT_KINDS[ObjectKind.Tower];
    const { margin: m, shaftInset, bandBottom, bandTop, merlonSize: size, merlonHeight } = TOWER_SIZES;
    const shape = new ShapeBuilder().addBox(castleFoundation(m, m, w - m, d - m), SHAPE_COLORS.foundation);
    const s = m + shaftInset;
    const shaft: BoxSpec = { x0: s, z0: s, x1: w - s, z1: d - s, y0: FOUNDATION_LIFT, y1: bandBottom };
    shape.addCourses(shaft, SHAPE_COLORS.stone, 6, COURSE_SALT);
    addPlinth(shape, shaft, 0.22, 0.05);
    addPlinth(shape, shaft, 0.12, 0.1);
    this.addSlits(shape, shaft, w);
    addDoor(shape, { wall: shaft, face: 'south', along: w / 2, bottom: FOUNDATION_LIFT + 0.12, width: 0.34, height: 0.62 });
    this.addCorbels(shape, shaft);
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
    addBanner(shape, w / 2, d / 2, bandTop, 1.2);
    return shape.build();
  }

  /** Two arrow slits on each face, staggered; the front's lower one gives way to the door. */
  private addSlits(shape: ShapeBuilder, shaft: BoxSpec, w: number): void {
    for (const face of ['south', 'north', 'east', 'west'] as const satisfies readonly WallFace[]) {
      if (face !== 'south') addArrowSlit(shape, { wall: shaft, face, along: w / 2 - 0.25, bottom: 0.8, width: 0.08, height: 0.4 });
      addArrowSlit(shape, { wall: shaft, face, along: w / 2 + 0.25, bottom: 1.55, width: 0.08, height: 0.4 });
    }
  }

  /** Corbels under the parapet band along every side of the shaft, reaching out to the band's edge. */
  private addCorbels(shape: ShapeBuilder, shaft: BoxSpec): void {
    const { corbel: c, corbelSpacing: step, shaftInset: out, bandBottom } = TOWER_SIZES;
    const y0 = bandBottom - 0.16;
    for (let a = shaft.x0 + 0.1; a <= shaft.x1 - 0.1 - c; a += step) {
      shape.addBox({ x0: a, x1: a + c, z0: shaft.z1, z1: shaft.z1 + out, y0, y1: bandBottom }, SHAPE_COLORS.darkStone);
      shape.addBox({ x0: a, x1: a + c, z0: shaft.z0 - out, z1: shaft.z0, y0, y1: bandBottom }, SHAPE_COLORS.darkStone);
      shape.addBox({ x0: shaft.x1, x1: shaft.x1 + out, z0: a, z1: a + c, y0, y1: bandBottom }, SHAPE_COLORS.darkStone);
      shape.addBox({ x0: shaft.x0 - out, x1: shaft.x0, z0: a, z1: a + c, y0, y1: bandBottom }, SHAPE_COLORS.darkStone);
    }
  }
}
