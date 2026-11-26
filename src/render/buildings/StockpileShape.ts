// The Stockpile: a deck of boards in alternating shades with raised edge beams, and capped corner posts joined by rails
// along the back and sides. The stacks on it are drawn by `StockpileStacks`.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { ShapeBuilder } from './ShapeBuilder';
import { type BoxSpec, SHAPE_COLORS } from './shapeParts';
import { shadeVariant } from './shadeVariant';

const BOARDS = 8;
const BOARD_SALT = 0x5a1;
const EDGE = { width: 0.08, rise: 0.05 } as const;
const RAIL = { y0: 0.5, y1: 0.56, thickness: 0.06 } as const;

export class StockpileShape implements BuildingShape {
  /** Height of the deck's top above the floor; stacks stand on it. */
  public static readonly deckTop = 0.2;
  /** Distance of the deck's edges from the footprint's edges. */
  public static readonly deckInset = 0.25;
  private static readonly postSize = 0.16;
  private static readonly postHeight = 0.75;

  /** Creates a new Stockpile model (see `BuildingShape.build`). */
  public build(): THREE.Mesh {
    const { width: w, height: d } = OBJECT_KINDS[ObjectKind.Stockpile];
    const shape = new ShapeBuilder().addFoundation(w, d);
    const i = StockpileShape.deckInset;
    const top = StockpileShape.deckTop;
    const step = (d - 2 * i) / BOARDS;
    for (let b = 0; b < BOARDS; b++) {
      const board: BoxSpec = { x0: i, x1: w - i, z0: i + b * step, z1: i + (b + 1) * step, y0: 0, y1: top };
      shape.addBox(board, shadeVariant(SHAPE_COLORS.darkTimber, BOARD_SALT, b, 0.1));
    }
    this.addEdgeBeams(shape, w, d);
    this.addPosts(shape, w, d);
    return shape.build();
  }

  /** Beams along the deck's four edges, standing a little above the boards. */
  private addEdgeBeams(shape: ShapeBuilder, w: number, d: number): void {
    const i = StockpileShape.deckInset;
    const e = EDGE.width;
    const [y0, y1] = [0, StockpileShape.deckTop + EDGE.rise];
    const beams: BoxSpec[] = [
      { x0: i, x1: w - i, z0: i, z1: i + e, y0, y1 },
      { x0: i, x1: w - i, z0: d - i - e, z1: d - i, y0, y1 },
      { x0: i, x1: i + e, z0: i, z1: d - i, y0, y1 },
      { x0: w - i - e, x1: w - i, z0: i, z1: d - i, y0, y1 },
    ];
    for (const beam of beams) shape.addBox(beam, SHAPE_COLORS.timber);
  }

  /** Capped corner posts, joined by rails along the back and both sides (the front stays open). */
  private addPosts(shape: ShapeBuilder, w: number, d: number): void {
    const i = StockpileShape.deckInset;
    const s = StockpileShape.postSize;
    const y1 = StockpileShape.postHeight;
    for (const x of [i, w - i - s]) {
      for (const z of [i, d - i - s]) {
        shape.addBox({ x0: x, z0: z, x1: x + s, z1: z + s, y0: 0, y1 }, SHAPE_COLORS.timber);
        shape.addBox({ x0: x - 0.02, z0: z - 0.02, x1: x + s + 0.02, z1: z + s + 0.02, y0: y1, y1: y1 + 0.05 }, SHAPE_COLORS.darkTimber);
      }
    }
    const t = RAIL.thickness;
    const c = (s - t) / 2;
    const rails: BoxSpec[] = [
      { x0: i, x1: w - i, z0: i + c, z1: i + c + t, y0: RAIL.y0, y1: RAIL.y1 },
      { x0: i + c, x1: i + c + t, z0: i, z1: d - i, y0: RAIL.y0, y1: RAIL.y1 },
      { x0: w - i - c - t, x1: w - i - c, z0: i, z1: d - i, y0: RAIL.y0, y1: RAIL.y1 },
    ];
    for (const rail of rails) shape.addBox(rail, SHAPE_COLORS.darkTimber);
  }
}
