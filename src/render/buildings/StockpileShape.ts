// The Stockpile: a low plank deck with four corner posts. The stacks on it are drawn by `StockpileStacks`.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { ShapeBuilder } from './ShapeBuilder';
import { type BoxSpec, SHAPE_COLORS } from './shapeParts';

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
    const deck: BoxSpec = { x0: i, z0: i, x1: w - i, z1: d - i, y0: 0, y1: StockpileShape.deckTop };
    shape.addBox(deck, SHAPE_COLORS.darkTimber);
    const s = StockpileShape.postSize;
    const y1 = StockpileShape.postHeight;
    for (const x of [i, w - i - s]) {
      for (const z of [i, d - i - s]) {
        shape.addBox({ x0: x, z0: z, x1: x + s, z1: z + s, y0: 0, y1 }, SHAPE_COLORS.timber);
      }
    }
    return shape.build();
  }
}
