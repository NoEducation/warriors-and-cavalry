// The Wheat farm: a field of bare earth inside a post-and-rail fence with a gate gap at the front, watched by a
// scarecrow. The crop on it is drawn by `FarmCrops`.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { ShapeBuilder } from './ShapeBuilder';
import { type BoxSpec, FOOTPRINT_MARGIN, SHAPE_COLORS } from './shapeParts';

const POST_SIZE = 0.12;
const POST_HEIGHT = 0.5;
const RAIL_THICKNESS = 0.06;
/** Heights of the two rails' bottoms; each rail is `RAIL_THICKNESS` tall. */
const RAIL_HEIGHTS = [0.18, 0.36] as const;
/** Posts per side, corners included, and the width of the gate gap in the middle of the front side. */
const POSTS_PER_SIDE = 7;
const GATE_WIDTH = 0.7;
/** The scarecrow's spot inside the field's back corner, away from the camera. */
const SCARECROW = { x: 3.0, z: 1.0 } as const;

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
    const step = (w - 2 * m - s) / (POSTS_PER_SIDE - 1);
    const gate = [(w - GATE_WIDTH) / 2, (w + GATE_WIDTH) / 2] as const;
    for (let i = 0; i < POSTS_PER_SIDE; i++) {
      const a = m + i * step;
      const inGate = a + s > gate[0] && a < gate[1];
      const corner = i === 0 || i === POSTS_PER_SIDE - 1;
      const spots: [number, number][] = corner ? [[a, m]] : [[a, m], [m, a], [w - m - s, a]];
      if (!inGate) spots.push([a, d - m - s]);
      for (const [x, z] of spots) shape.addBox({ x0: x, z0: z, x1: x + s, z1: z + s, y0: 0, y1: POST_HEIGHT }, SHAPE_COLORS.darkTimber);
    }
    for (const [x, z] of [[gate[0] - s, d - m - s], [gate[1], d - m - s]] as const) {
      shape.addBox({ x0: x, z0: z, x1: x + s, z1: z + s, y0: 0, y1: POST_HEIGHT + 0.1 }, SHAPE_COLORS.darkTimber);
    }
    for (const rail of this.rails(w, d, gate)) shape.addBox(rail, SHAPE_COLORS.timber);
    this.addScarecrow(shape);
    return shape.build();
  }

  /** Two rails along each side between the corner posts, broken at the front by the gate gap. */
  private rails(w: number, d: number, gate: readonly [number, number]): BoxSpec[] {
    const m = FOOTPRINT_MARGIN;
    const t = RAIL_THICKNESS;
    const c = POST_SIZE / 2 - t / 2; // centres the rail on the posts
    return RAIL_HEIGHTS.flatMap((y0) => {
      const y1 = y0 + t;
      const front = { z0: d - m - c - t, z1: d - m - c, y0, y1 };
      return [
        { x0: m, z0: m + c, x1: w - m, z1: m + c + t, y0, y1 },
        { x0: m, x1: gate[0], ...front },
        { x0: gate[1], x1: w - m, ...front },
        { x0: m + c, z0: m, x1: m + c + t, z1: d - m, y0, y1 },
        { x0: w - m - c - t, z0: m, x1: w - m - c, z1: d - m, y0, y1 },
      ];
    });
  }

  /** A scarecrow: a post with a cross arm, a shirt, a straw head and a hat. */
  private addScarecrow(shape: ShapeBuilder): void {
    const { x, z } = SCARECROW;
    shape.addBox({ x0: x - 0.03, x1: x + 0.03, z0: z - 0.03, z1: z + 0.03, y0: 0, y1: 0.95 }, SHAPE_COLORS.darkTimber);
    shape.addBox({ x0: x - 0.3, x1: x + 0.3, z0: z - 0.025, z1: z + 0.025, y0: 0.7, y1: 0.75 }, SHAPE_COLORS.darkTimber);
    shape.addBox({ x0: x - 0.12, x1: x + 0.12, z0: z - 0.07, z1: z + 0.07, y0: 0.45, y1: 0.78 }, SHAPE_COLORS.banner);
    shape.addBox({ x0: x - 0.08, x1: x + 0.08, z0: z - 0.08, z1: z + 0.08, y0: 0.8, y1: 0.96 }, SHAPE_COLORS.straw);
    shape.addBox({ x0: x - 0.13, x1: x + 0.13, z0: z - 0.13, z1: z + 0.13, y0: 0.96, y1: 1.0 }, SHAPE_COLORS.hutRoof);
    shape.addBox({ x0: x - 0.07, x1: x + 0.07, z0: z - 0.07, z1: z + 0.07, y0: 1.0, y1: 1.08 }, SHAPE_COLORS.hutRoof);
  }
}
