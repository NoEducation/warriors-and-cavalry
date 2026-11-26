// Where idle peasants wait: on the wall walk as lookouts when stairs lead up to it, else each on its own free tile
// around the Keep, found ring by ring in a fixed order.
import type { MapObject } from './MapObject';
import { OBJECT_KINDS, ObjectKind } from './ObjectKind';
import type { Peasant } from './Peasant';
import type { PeasantWalker } from './PeasantWalker';
import type { PopulationHost } from './PopulationHost';
import type { TileCoord } from './TileCoord';
import { WalkClass } from './walkRules';
import type { WallLookouts } from './WallLookouts';
import { Footprint } from './Footprint';

export class IdleStands {
  /**
   * Stands for the idle peasants among `peasants` (Population's own map, read live) in `world`; `keep` gives the
   * Keep they gather at (null without one).
   */
  public constructor(
    private readonly world: PopulationHost,
    private readonly walker: PeasantWalker,
    private readonly peasants: ReadonlyMap<number, Peasant>,
    private readonly keep: () => MapObject | null,
    private readonly lookouts: WallLookouts,
  ) {}

  /**
   * Advances the idle `p` by one tick: one without a stand, whose stand was built over or whose way there was, climbs
   * to the nearest free wall-walk tile it can reach, else takes the first free tile around the Keep, and heads there;
   * then it walks. With no Keep it stays where it is; with no
   * free tile in reach it waits and tries again later. Call once per tick per idle peasant, in ascending id order.
   */
  public tick(p: Peasant): void {
    if (p.waitTicks > 0 && !p.countDownWait()) return;
    if (this.needsNewStand(p)) this.takeStand(p);
    this.walker.tick(p);
  }

  /**
   * Call when a wall, tower or stairs is added or removed: idle peasants standing on the ground look for a stand
   * again while stairs stand (a way up may have opened), and so do those whose stand was on a piece just removed.
   */
  public castleChanged(removed: MapObject | null): void {
    const gone = removed ? Footprint.of(removed.kind, removed.tx, removed.ty) : null;
    for (const p of this.peasants.values()) {
      const { stand } = p;
      if (p.state !== 'idle' || !stand) continue;
      const onGround = this.world.walkClass(stand.tx, stand.ty) === WalkClass.Ground;
      if ((onGround && this.lookouts.anyStairs) || gone?.covers(stand.tx, stand.ty)) p.standOn(null);
    }
  }

  /**
   * True when `p` has no stand (and is not waiting), its stand is no longer ground or a wall-walk top, or its way
   * there is blocked.
   */
  private needsNewStand(p: Peasant): boolean {
    const { stand } = p;
    if (!stand) return p.waitTicks === 0;
    const at = this.world.walkClass(stand.tx, stand.ty);
    return (at !== WalkClass.Ground && at !== WalkClass.Top) || this.walker.isNextStepBlocked(p);
  }

  /** Gives `p` the first free tile around the Keep that it can reach and sends it there. */
  private takeStand(p: Peasant): void {
    p.standOn(null);
    p.startWalk([]);
    const keep = this.keep();
    if (!keep) return;
    const taken = this.takenStands();
    const lookout = this.lookouts.headUp(p, taken);
    if (lookout) {
      p.standOn(lookout);
      return;
    }
    const tile = this.firstFreeTile(keep, taken);
    if (tile && this.walker.walkTo(p, [tile])) p.standOn(tile);
    else p.waitToRetry();
  }

  /** The stands of the idle peasants, as `ty * width + tx`. */
  private takenStands(): Set<number> {
    const taken = new Set<number>();
    for (const other of this.peasants.values()) {
      if (other.stand) taken.add(other.stand.ty * this.world.map.width + other.stand.tx);
    }
    return taken;
  }

  /** The first ground tile, not a gate nor in `taken`, on the rings around `keep`, nearest ring first; else null. */
  private firstFreeTile(keep: MapObject, taken: Set<number>): TileCoord | null {
    const { width, height } = OBJECT_KINDS[keep.kind];
    const { map } = this.world;
    // A gate is the way through a wall and stairs the way up it, so nobody waits in either.
    const isFree = (tx: number, ty: number): boolean =>
      this.world.walkClass(tx, ty) === WalkClass.Ground &&
      this.world.objectAt(tx, ty)?.kind !== ObjectKind.Gate &&
      !taken.has(ty * map.width + tx);
    for (let r = 1; r <= Math.max(map.width, map.height); r++) {
      const left = keep.tx - r;
      const top = keep.ty - r;
      const tile = firstOnRing(left, top, keep.tx + width - 1 + r, keep.ty + height - 1 + r, isFree);
      if (tile) return tile;
    }
    return null;
  }
}

/**
 * The first tile for which `accept` holds on the ring with these bounds, in the order: bottom side left to right,
 * right side top to bottom, top side left to right, left side top to bottom (corners left out), then the corners
 * bottom-left, bottom-right, top-right, top-left. Null when there is none.
 */
function firstOnRing(
  left: number,
  top: number,
  right: number,
  bottom: number,
  accept: (tx: number, ty: number) => boolean,
): TileCoord | null {
  for (let tx = left + 1; tx < right; tx++) if (accept(tx, bottom)) return { tx, ty: bottom };
  for (let ty = top + 1; ty < bottom; ty++) if (accept(right, ty)) return { tx: right, ty };
  for (let tx = left + 1; tx < right; tx++) if (accept(tx, top)) return { tx, ty: top };
  for (let ty = top + 1; ty < bottom; ty++) if (accept(left, ty)) return { tx: left, ty };
  const corners: [number, number][] = [[left, bottom], [right, bottom], [right, top], [left, top]];
  for (const [tx, ty] of corners) if (accept(tx, ty)) return { tx, ty };
  return null;
}
