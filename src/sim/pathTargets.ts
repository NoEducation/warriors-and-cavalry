// Multi-goal walks toward several places at once: their goal tiles, and which place a found path leads to.
import type { PeasantView } from './PeasantView';
import type { TileCoord } from './TileCoord';

/** A place a walker may head for (a storage place, a tree) and the tiles it can be reached from. */
export interface PathTarget {
  readonly id: number;
  readonly tiles: readonly TileCoord[];
}

/** Every goal tile of `targets`, in order (repeats are fine: the path-finder counts them once). */
export function targetTiles(targets: readonly PathTarget[]): TileCoord[] {
  const goals: TileCoord[] = [];
  for (const target of targets) goals.push(...target.tiles);
  return goals;
}

/**
 * The first of `targets` with a tile where `p`'s walk ends (where it stands when the walk is empty); undefined when
 * none. Call right after a walk toward `targetTiles(targets)` was found.
 */
export function targetAtWalkEnd<T extends PathTarget>(p: PeasantView, targets: readonly T[]): T | undefined {
  const end = p.path.length > 0 ? p.path[p.path.length - 1] : { tx: p.nextTx, ty: p.nextTy };
  return targets.find(({ tiles }) => tiles.some((t) => t.tx === end.tx && t.ty === end.ty));
}
