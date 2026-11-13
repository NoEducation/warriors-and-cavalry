// The Wheat farm: a fenced field of bare earth. The crop on it is drawn by `FarmCrops`.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { ShapeBuilder } from './ShapeBuilder';
import { type BoxSpec, FOOTPRINT_MARGIN, SHAPE_COLORS } from './shapeParts';

const POST_SIZE = 0.14;
const POST_HEIGHT = 0.5;
const RAIL_THICKNESS = 0.06;

export class WheatFarmShape implements BuildingShape {
  /** Height of the soil's top above the floor; the crop stands on it. */
  public static readonly soilTop = 0.05;
  /** Distance of the crop's edges from the footprint's edges, inside the fence. */
  public static readonly fieldInset = 0.4;

  /** Creates a new Wheat farm model (see `BuildingShape.build`). */
  public build(): THREE.Mesh {
    const { width: w, height: d } = OBJECT_KINDS[ObjectKind.WheatFarm];
    const shape = new ShapeBuilder().addFoundation(w, d, SHAPE_COLORS.bareEarth, WheatFarmShape.soilTop);
    const m = FOOTPRINT_MARGIN;
    const s = POST_SIZE;
    for (const x of [m, w - m - s]) {
      for (const z of [m, d - m - s]) {
        shape.addBox({ x0: x, z0: z, x1: x + s, z1: z + s, y0: 0, y1: POST_HEIGHT }, SHAPE_COLORS.darkTimber);
      }
    }
    for (const rail of this.rails(w, d)) shape.addBox(rail, SHAPE_COLORS.timber);
    return shape.build();
  }

  /** One rail along each side of the field, between the corner posts. */
  private rails(w: number, d: number): BoxSpec[] {
    const m = FOOTPRINT_MARGIN;
    const t = RAIL_THICKNESS;
    const c = POST_SIZE / 2 - t / 2; // centres the rail on the posts
    const y0 = POST_HEIGHT - 0.2;
    const y1 = POST_HEIGHT - 0.12;
    return [
      { x0: m, z0: m + c, x1: w - m, z1: m + c + t, y0, y1 },
      { x0: m, z0: d - m - c - t, x1: w - m, z1: d - m - c, y0, y1 },
      { x0: m + c, z0: m, x1: m + c + t, z1: d - m, y0, y1 },
      { x0: w - m - c - t, z0: m, x1: w - m - c, z1: d - m, y0, y1 },
    ];
  }
}
