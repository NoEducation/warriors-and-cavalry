// Idle peasants keeping watch on the wall walk: while stairs stand, an idle peasant climbs to the nearest free wall or
// tower top it can reach. The groundwork for soldiers' posts.
import type { MapObject } from './MapObject';
import { ObjectKind } from './ObjectKind';
import { Footprint } from './Footprint';
import { PATH_CONFIG } from './pathConfig';
import type { Peasant } from './Peasant';
import type { PeasantWalker } from './PeasantWalker';
import type { PopulationHost } from './PopulationHost';
import type { TileCoord } from './TileCoord';
import { WalkMode } from './walkRules';

/** True for the castle pieces that make the wall walk or lead onto it. */
export function isWallWalkPiece(kind: ObjectKind): boolean {
  return kind === ObjectKind.Wall || kind === ObjectKind.Tower || kind === ObjectKind.Stairs;
}

export class WallLookouts {
  /** Stairs standing in the world; with none, nobody can climb, so nobody looks. */
  private stairs = 0;

  /** Lookouts on the walls of `world`, walked by `walker`. */
  public constructor(
    private readonly world: PopulationHost,
    private readonly walker: PeasantWalker,
  ) {}

  /** True while any stairs stand, so the wall walk may be reachable. */
  public get anyStairs(): boolean {
    return this.stairs > 0;
  }

  /** Call for every object added to the world: counts stairs. */
  public added(object: MapObject): void {
    if (object.kind === ObjectKind.Stairs) this.stairs++;
  }

  /** Call for every object removed from the world: counts stairs. */
  public removed(object: MapObject): void {
    if (object.kind === ObjectKind.Stairs) this.stairs--;
  }

  /**
   * Sends `p` climbing toward the nearest wall or tower top it can reach that is not in `taken` (tiles as
   * `ty * width + tx`), with one search bounded by `treeSearchMaxExpanded`. Returns that tile, or null (and leaves `p`
   * without a walk) when no stairs stand or none can be reached.
   */
  public headUp(p: Peasant, taken: ReadonlySet<number>): TileCoord | null {
    if (!this.anyStairs) return null;
    const { width } = this.world.map;
    const goals: TileCoord[] = [];
    for (const object of this.world.objects()) {
      if (object.kind !== ObjectKind.Wall && object.kind !== ObjectKind.Tower) continue;
      for (const tile of Footprint.of(object.kind, object.tx, object.ty).tiles()) {
        if (!taken.has(tile.ty * width + tile.tx)) goals.push(tile);
      }
    }
    if (!this.walker.walkTo(p, goals, PATH_CONFIG.treeSearchMaxExpanded, WalkMode.Climb)) return null;
    return p.path.length > 0 ? p.path[p.path.length - 1] : { tx: p.nextTx, ty: p.nextTy };
  }
}
