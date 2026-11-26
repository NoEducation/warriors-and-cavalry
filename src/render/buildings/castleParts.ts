// Sizes and parts shared by the stone castle pieces: walls, gates and towers.
import { type BoxSpec, FOUNDATION_DEPTH, FOUNDATION_LIFT } from './shapeParts';

/** Wall and gate sizes, in world units; pieces fill their whole tile so neighbours join into one wall. */
export const WALL_SIZES = {
  /** Top of the wall walk. */
  walkHeight: 1.2,
  /** Merlons sit on the walk and rise this far; chunky enough to read at the default camera distance. */
  merlonHeight: 0.45,
  /** Side of the square merlon on each corner of a wall tile; neighbours' corner merlons join into 0.6-wide ones. */
  merlonSize: 0.3,
  /** Width of a gate's opening across its passage. */
  openingWidth: 0.56,
  /** Height of a gate's opening above the floor. */
  openingHeight: 1,
  /** Size of the corner blocks that round off the top of a gate's opening into an arch. */
  archStep: 0.12,
} as const;

/** The foundation of a castle piece filling `x0..x1`, `z0..z1`, from `FOUNDATION_DEPTH` below the floor. */
export function castleFoundation(x0: number, z0: number, x1: number, z1: number): BoxSpec {
  return { x0, z0, x1, z1, y0: -FOUNDATION_DEPTH, y1: FOUNDATION_LIFT };
}

/** Square merlons of side `size` in the four corners of `x0..x1`, `z0..z1`, standing from `y0` to `y1`. */
export function cornerMerlons(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  size: number,
  y0: number,
  y1: number,
): BoxSpec[] {
  const merlons: BoxSpec[] = [];
  for (const [mx, mz] of [
    [x0, z0],
    [x1 - size, z0],
    [x0, z1 - size],
    [x1 - size, z1 - size],
  ]) {
    merlons.push({ x0: mx, z0: mz, x1: mx + size, z1: mz + size, y0, y1 });
  }
  return merlons;
}
