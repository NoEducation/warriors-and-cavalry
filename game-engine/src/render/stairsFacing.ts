// Which way a flight of stairs climbs, from the castle pieces beside it. Shared by the built stairs and their ghost.
import { ObjectKind } from '../sim/ObjectKind';
import type { World } from '../sim/World';
import type { StairsFacing } from './buildings/StairsShape';

/** The sides a stair looks at for its wall, in this order, with the neighbour tile each side means. */
const SIDES: ReadonlyArray<readonly [StairsFacing, number, number]> = [
  ['north', 0, -1],
  ['west', -1, 0],
  ['east', 1, 0],
  ['south', 0, 1],
];

/**
 * The way stairs on tile (tx, ty) of `world` climb: toward the first side, of north, west, east and south, whose
 * neighbour is a Wall or Tower; north when none is. Call when a stairs mesh is made, for the built stairs and the ghost.
 */
export function stairsFacing(world: World, tx: number, ty: number): StairsFacing {
  for (const [facing, dx, dy] of SIDES) {
    const kind = world.objectAt(tx + dx, ty + dy)?.kind;
    if (kind === ObjectKind.Wall || kind === ObjectKind.Tower) return facing;
  }
  return 'north';
}
