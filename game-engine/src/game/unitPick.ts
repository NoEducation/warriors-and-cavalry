// Finding units under the cursor: the nearest one by a clicked tile, and the ones inside a dragged screen box.
import type * as THREE from 'three';
import type { NdcPoint } from '../input/Pointer';
import type { TileCoord } from '../sim/TileCoord';
import type { Side } from '../sim/UnitKind';
import type { UnitView } from '../sim/UnitView';
import type { World } from '../sim/World';

/** A unit's id and where it is drawn. */
export interface DrawnUnit {
  readonly id: number;
  readonly at: THREE.Vector3;
}

/** The living unit of `side` on `tile` or a tile next to it, nearest to it first (ties to the lowest id); else null. */
export function nearestUnit(world: World, tile: TileCoord, side: Side): UnitView | null {
  let best: UnitView | null = null;
  let bestDistance = 2;
  for (const unit of world.units()) {
    if (unit.side !== side || unit.hitPoints <= 0) continue;
    const d = Math.max(Math.abs(unit.tx - tile.tx), Math.abs(unit.ty - tile.ty));
    if (d < bestDistance) [best, bestDistance] = [unit, d];
  }
  return best;
}

/** The ids of `units` whose drawn position, seen through `camera`, falls in the screen box between `a` and `b` (NDC). */
export function unitsInBox(units: readonly DrawnUnit[], camera: THREE.Camera, a: NdcPoint, b: NdcPoint): number[] {
  const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  const ids: number[] = [];
  for (const { id, at } of units) {
    const p = at.clone().project(camera);
    if (p.z <= 1 && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) ids.push(id);
  }
  return ids;
}
