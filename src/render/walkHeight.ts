// How high a walker stands on a tile: on the ground, or up on the wall walk of a wall or tower.
import { ObjectKind } from '../sim/ObjectKind';
import type { World } from '../sim/World';
import { WALL_SIZES } from './buildings/castleParts';
import { TOWER_TOP } from './buildings/TowerShape';
import { floorHeight } from './floorHeight';

/**
 * The height a walker on tile (tx, ty) of `world` is drawn at: the wall walk on a wall (its floor + `walkHeight`), the
 * parapet on a tower (its floor + `TOWER_TOP`), else the tile's ground height (stairs included: a walker climbs them
 * as it steps between the stair and the wall). Call per peasant per tick.
 */
export function walkHeight(world: World, tx: number, ty: number): number {
  const object = world.objectAt(tx, ty);
  if (object?.kind === ObjectKind.Wall) return floorHeight(world.map, object.kind, object.tx, object.ty) + WALL_SIZES.walkHeight;
  if (object?.kind === ObjectKind.Tower) return floorHeight(world.map, object.kind, object.tx, object.ty) + TOWER_TOP;
  return world.map.tileHeight(tx, ty);
}
