// One soldier or raider: its state and every change to it, each a named transition.
import { POPULATION_CONFIG } from './populationConfig';
import type { TileCoord } from './TileCoord';
import { type Side, type UnitKind, UNIT_KINDS } from './UnitKind';
import type { UnitOrder, UnitTarget, UnitView } from './UnitView';
import type { Walker } from './Walker';
import { WalkMode } from './walkRules';

const NO_TILES: readonly TileCoord[] = Object.freeze([]);

/** The mutable unit record. `Army` and its helpers change it; everyone else sees it as a `UnitView`. */
export class Unit implements UnitView, Walker {
  public tx: number;
  public ty: number;
  public nextTx: number;
  public nextTy: number;
  public stepProgress = 0;
  public stepTicks = 0;
  public path = NO_TILES;
  public pathIndex = 0;
  public walkMode: WalkMode = WalkMode.Ground;
  public hitPoints: number;
  public cooldown = 0;
  public order: UnitOrder = 'idle';
  public target: UnitTarget | null = null;
  public lastStrikeTick = -1;
  public waitTicks = 0;
  public moveTx: number;
  public moveTy: number;
  public chaseTx = -1;
  public chaseTy = -1;
  public ignoreId = 0;
  public ignoreTicks = 0;

  /** A new, idle unit of `kind` for `side` at full hit points, standing on tile (tx, ty). */
  public constructor(
    public readonly id: number,
    public readonly side: Side,
    public readonly kind: UnitKind,
    tx: number,
    ty: number,
  ) {
    this.tx = this.nextTx = this.moveTx = tx;
    this.ty = this.nextTy = this.moveTy = ty;
    this.hitPoints = UNIT_KINDS[kind].hitPoints;
  }

  /** True while its hit points are above 0. */
  public get alive(): boolean {
    return this.hitPoints > 0;
  }

  /** Replaces the current walk with `path` (empty to stop after the current step), walked in `mode`. */
  public startWalk(path: readonly TileCoord[], mode: WalkMode = WalkMode.Ground): void {
    this.path = path;
    this.pathIndex = 0;
    this.walkMode = mode;
  }

  /** Starts the step onto the next tile of its walk, taking `ticks` ticks. Call only between steps, with tiles left. */
  public stepToNextTile(ticks: number): void {
    const next = this.path[this.pathIndex++];
    this.nextTx = next.tx;
    this.nextTy = next.ty;
    this.stepProgress = 0;
    this.stepTicks = ticks;
  }

  /** Advances the current step by one tick; on its last tick it stands on the next tile and stops moving. */
  public advanceStep(): void {
    this.stepProgress++;
    if (this.stepProgress < this.stepTicks) return;
    this.tx = this.nextTx;
    this.ty = this.nextTy;
    this.stepProgress = 0;
    this.stepTicks = 0;
  }

  /** True when it stands at the end of its walk: no step under way and no tile left. */
  public get walkDone(): boolean {
    return this.stepTicks === 0 && this.pathIndex >= this.path.length;
  }

  /** Gives it a new order (and target), dropping its walk, any wait and its chase tile. */
  public setOrder(order: UnitOrder, target: UnitTarget | null, moveTx = this.moveTx, moveTy = this.moveTy): void {
    this.order = order;
    this.target = target;
    this.moveTx = moveTx;
    this.moveTy = moveTy;
    this.waitTicks = 0;
    this.chaseTx = this.chaseTy = -1;
    this.startWalk(NO_TILES, this.walkMode);
  }

  /** Sets what it goes for (null for nothing), keeping its order. A new target forgets the chase tile. */
  public setTarget(target: UnitTarget | null): void {
    if (target?.type === this.target?.type && target?.id === this.target?.id) return;
    this.target = target;
    this.chaseTx = this.chaseTy = -1;
  }

  /** Gives up on its target for a while: forgets it and skips it for the retry wait. */
  public ignoreTarget(): void {
    if (this.target && this.target.type !== 'building') {
      this.ignoreId = this.target.id;
      this.ignoreTicks = this.retryWait();
    }
    this.setTarget(null);
  }

  /** Strikes at tick `tick`: it may not strike again for its kind's strike ticks. */
  public strike(tick: number): void {
    this.cooldown = UNIT_KINDS[this.kind].strikeTicks;
    this.lastStrikeTick = tick;
  }

  /** Counts its cooldown and its ignore time down by one tick. Call once per tick before it acts. */
  public countDown(): void {
    if (this.cooldown > 0) this.cooldown--;
    if (this.ignoreTicks > 0 && --this.ignoreTicks === 0) this.ignoreId = 0;
  }

  /** After a failed search: waits `retryTicks` plus `id % retrySpread` ticks before searching again. */
  public waitToRetry(): void {
    this.waitTicks = this.retryWait();
  }

  private retryWait(): number {
    return POPULATION_CONFIG.retryTicks + (this.id % POPULATION_CONFIG.retrySpread);
  }
}
