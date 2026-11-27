// Which way a gate's opening runs, from the castle pieces beside it. Shared by the built gate and its ghost.
import { ObjectKind } from '../sim/ObjectKind';
import type { World } from '../sim/World';
import type { GatePassage } from './buildings/GateShape';

/** Kinds that make up a castle wall line; a gate next to one of them is turned to pass through the line. */
const WALL_LINE_KINDS: readonly ObjectKind[] = [ObjectKind.Wall, ObjectKind.Gate, ObjectKind.Tower];

/**
 * The passage of a gate on tile (tx, ty) of `world`: north–south when a wall piece stands west or east of it (the wall
 * runs east–west), otherwise east–west. Call when a gate's mesh is made, for the built gate and for its ghost alike.
 */
export function gatePassage(world: World, tx: number, ty: number): GatePassage {
  const besideWall = [tx - 1, tx + 1].some((x) => {
    const neighbour = world.objectAt(x, ty);
    return neighbour !== undefined && WALL_LINE_KINDS.includes(neighbour.kind);
  });
  return besideWall ? 'northSouth' : 'eastWest';
}
