// The Keep: a battlemented stone hall in shaded courses on a battered plinth, with buttresses, a string course, arrow
// slits, a forebuilding with a door and steps at the front, and a taller corner tower flying a banner.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { addBanner, edgeMerlons } from './castleParts';
import { addArrowSlit, addDoor, addPlinth, type FaceSpot } from './detailParts';
import { ShapeBuilder } from './ShapeBuilder';
import { type BoxSpec, FOUNDATION_LIFT, SHAPE_COLORS } from './shapeParts';

const HALL: BoxSpec = { x0: 0.55, z0: 0.5, x1: 3.45, z1: 3.2, y0: 0, y1: 2.2 };
const TOWER: BoxSpec = { x0: 0.2, z0: 0.2, x1: 1.55, z1: 1.55, y0: 0, y1: 3.6 };
const FORE: BoxSpec = { x0: 1.45, z0: 3.2, x1: 2.55, z1: 3.62, y0: 0, y1: 1.3 };
const STRING_COURSE = { y0: 1.5, y1: 1.6 } as const;
const MERLON = { size: 0.22, height: 0.3 } as const;
const SALT = { hall: 0x4e1, tower: 0x4e2, fore: 0x4e3 } as const;

export class KeepShape implements BuildingShape {
  /** Creates a new Keep model (see `BuildingShape.build`). */
  public build(): THREE.Mesh {
    const { width: w, height: d } = OBJECT_KINDS[ObjectKind.Keep];
    const shape = new ShapeBuilder().addFoundation(w, d);
    for (const part of [HALL, TOWER]) {
      addPlinth(shape, part, 0.32, 0.06);
      addPlinth(shape, part, 0.16, 0.11);
    }
    shape.addCourses(HALL, SHAPE_COLORS.stone, 6, SALT.hall);
    this.addBand(shape, { ...HALL, y0: STRING_COURSE.y0, y1: STRING_COURSE.y1 }, 0.04);
    this.addCrown(shape, HALL, 0.04);
    this.addButtresses(shape);
    this.addSlits(shape);
    shape.addCourses(TOWER, SHAPE_COLORS.stone, 9, SALT.tower);
    this.addCrown(shape, TOWER, 0.07);
    addArrowSlit(shape, { wall: TOWER, face: 'west', along: 0.9, bottom: 2.5, width: 0.08, height: 0.4 });
    addBanner(shape, 0.88, 0.88, TOWER.y1 + 0.15, 1.1);
    this.addForebuilding(shape);
    return shape.build();
  }

  /** A darker band round `spec`, standing `proud` out from it. */
  private addBand(shape: ShapeBuilder, spec: BoxSpec, proud: number): void {
    const band = { x0: spec.x0 - proud, x1: spec.x1 + proud, z0: spec.z0 - proud, z1: spec.z1 + proud, y0: spec.y0, y1: spec.y1 };
    shape.addBox(band, SHAPE_COLORS.darkStone);
  }

  /** A parapet band round the top of `spec` with merlons all round its edge. */
  private addCrown(shape: ShapeBuilder, spec: BoxSpec, proud: number): void {
    const top = spec.y1 + 0.14;
    this.addBand(shape, { ...spec, y0: spec.y1, y1: top }, proud);
    const { x0, z0, x1, z1 } = spec;
    for (const merlon of edgeMerlons(x0 - proud, z0 - proud, x1 + proud, z1 + proud, MERLON.size, top, top + MERLON.height)) {
      shape.addBox(merlon, SHAPE_COLORS.stone);
    }
  }

  /** Stepped buttresses at the front corners and the middle of the east wall. */
  private addButtresses(shape: ShapeBuilder): void {
    const b = 0.24;
    const spots: BoxSpec[] = [
      { x0: HALL.x1 - b, x1: HALL.x1, z0: HALL.z1, z1: HALL.z1 + 0.16, y0: 0, y1: 1.4 },
      { x0: HALL.x0, x1: HALL.x0 + b, z0: HALL.z1, z1: HALL.z1 + 0.16, y0: 0, y1: 1.4 },
      { x0: HALL.x1, x1: HALL.x1 + 0.16, z0: 1.85 - b / 2, z1: 1.85 + b / 2, y0: 0, y1: 1.4 },
    ];
    for (const spec of spots) {
      shape.addBox(spec, SHAPE_COLORS.stone);
      // The upper step stands half as far out from the wall, up to just above the string course.
      const upper = spec.z0 === HALL.z1 ? { ...spec, z1: HALL.z1 + 0.08 } : { ...spec, x1: HALL.x1 + 0.08 };
      shape.addBox({ ...upper, y0: spec.y1, y1: STRING_COURSE.y1 + 0.2 }, SHAPE_COLORS.darkStone);
    }
  }

  /** Arrow slits on the front and east walls, below and above the string course. */
  private addSlits(shape: ShapeBuilder): void {
    const slit = (face: FaceSpot['face'], along: number, bottom: number): void =>
      addArrowSlit(shape, { wall: HALL, face, along, bottom, width: 0.08, height: 0.38 });
    for (const x of [1.05, 2.95]) slit('south', x, 0.75);
    for (const x of [1.05, 2.0, 2.95]) slit('south', x, 1.72);
    for (const z of [1.2, 2.55]) {
      slit('east', z, 0.75);
      slit('east', z, 1.72);
    }
  }

  /** The forebuilding at the front: courses, a crown, a door, and steps up to it. */
  private addForebuilding(shape: ShapeBuilder): void {
    shape.addCourses(FORE, SHAPE_COLORS.stone, 3, SALT.fore);
    this.addCrown(shape, FORE, 0.03);
    const cx = (FORE.x0 + FORE.x1) / 2;
    addDoor(shape, { wall: FORE, face: 'south', along: cx, bottom: FOUNDATION_LIFT + 0.12, width: 0.34, height: 0.62 });
    for (const [k, y1] of [0.12, 0.22].entries()) {
      const spec: BoxSpec = { x0: cx - 0.3, x1: cx + 0.3, z0: FORE.z1, z1: FORE.z1 + 0.1 * (2 - k), y0: 0, y1 };
      shape.addBox(spec, SHAPE_COLORS.foundation);
    }
  }
}
