// The Stairs: a flight of stone steps filling its tile, rising from the ground to the wall walk on the side it faces,
// with a dark nosing on each step so the flight reads at a distance.
import type * as THREE from 'three';
import type { BuildingShape } from './BuildingShape';
import { castleFoundation, WALL_SIZES } from './castleParts';
import { ShapeBuilder } from './ShapeBuilder';
import { SHAPE_COLORS } from './shapeParts';

/** The side of its tile a flight of stairs climbs toward: the side its wall stands on. */
export type StairsFacing = 'north' | 'west' | 'east' | 'south';

/** Stairs sizes, in world units. */
const STAIRS_SIZES = {
  steps: 6,
  /** Depth of the darker band along the front edge of each step. */
  nosing: 0.04,
} as const;

/** Turn about the tile's centre that takes a flight climbing north (toward -z) to one climbing toward the facing. */
const TURN: Record<StairsFacing, number> = { north: 0, west: Math.PI / 2, east: -Math.PI / 2, south: Math.PI };

export class StairsShape implements BuildingShape {
  /** Creates a new Stairs model (see `BuildingShape.build`) climbing toward `facing` (north when left out). */
  public build(facing: StairsFacing = 'north'): THREE.Mesh {
    const { steps, nosing } = STAIRS_SIZES;
    const depth = 1 / steps;
    const shape = new ShapeBuilder().addBox(castleFoundation(0, 0, 1, 1), SHAPE_COLORS.foundation);
    for (let i = 0; i < steps; i++) {
      // Step i runs from the back of the tile (z = 1) toward the wall (z = 0), each one higher.
      const z1 = 1 - i * depth;
      const z0 = z1 - depth;
      const top = (WALL_SIZES.walkHeight * (i + 1)) / steps;
      shape.addBox({ x0: 0, x1: 1, z0, z1: z1 - nosing, y0: 0, y1: top }, i % 2 === 0 ? SHAPE_COLORS.stone : SHAPE_COLORS.cutStone);
      shape.addBox({ x0: 0, x1: 1, z0: z1 - nosing, z1, y0: 0, y1: top }, SHAPE_COLORS.darkStone);
    }
    const mesh = shape.build();
    mesh.geometry.translate(-0.5, 0, -0.5).rotateY(TURN[facing]).translate(0.5, 0, 0.5);
    return mesh;
  }
}
