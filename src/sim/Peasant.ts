// One peasant: where it stands, the step it is taking, what it carries and the walk it is on.
import type { ResourceKind } from './ResourceKind';
import type { TileCoord } from './TileCoord';

/** Every peasant state, in checksum order (a state's index is what the checksum covers). */
export const PEASANT_STATES = Object.freeze(['idle', 'toWork', 'working', 'toStore', 'toWorkBack'] as const);

/** What a peasant is doing: nothing, walking to work, working, carrying to storage or walking back to work. */
export type PeasantState = (typeof PEASANT_STATES)[number];

/** Resources a peasant carries. */
export interface Load {
  readonly resource: ResourceKind;
  readonly amount: number;
}

/** Read-only view of a peasant, for render, UI and game code. */
export interface PeasantView {
  readonly id: number;
  readonly state: PeasantState;
  /** The tile it stands on, or the tile its current step started from. */
  readonly tx: number;
  readonly ty: number;
  /** The tile its current step leads to; (tx, ty) when it is not moving. */
  readonly nextTx: number;
  readonly nextTy: number;
  /** Ticks done of the current step, below `stepTicks`; 0 when not moving. */
  readonly stepProgress: number;
  /** Ticks the current step takes; 0 when not moving. */
  readonly stepTicks: number;
  readonly load: Load | null;
  /** Id of the building it works at; null when it has no job. */
  readonly workplaceId: number | null;
  /** The storage place it carries its load to; null when not delivering or no storage place is in reach. */
  readonly targetId: number | null;
  /** Ticks left before a carrier with no storage place in reach searches again; 0 when not waiting. */
  readonly waitTicks: number;
  /** The tiles of the current walk; `path[pathIndex]` is the next one to step onto. */
  readonly path: readonly TileCoord[];
  readonly pathIndex: number;
  /** Where the current walk leads, kept for searching again when the path is blocked. */
  readonly goals: readonly TileCoord[];
}

/**
 * The mutable peasant record. Only `Population` and its helpers (`Jobs`, `WorkerTrips`, `PeasantWalker`) change it;
 * everyone else sees it as a `PeasantView`.
 */
export class Peasant implements PeasantView {
  public state: PeasantState = 'idle';
  public nextTx: number;
  public nextTy: number;
  public stepProgress = 0;
  public stepTicks = 0;
  public load: Load | null = null;
  public workplaceId: number | null = null;
  /** The storage place it carries its load to; null when not delivering or no storage place is in reach. */
  public targetId: number | null = null;
  /** Ticks left before a carrier with no storage place in reach searches again; 0 when not waiting. */
  public waitTicks = 0;
  /** The tiles of the current walk; `path[pathIndex]` is the next one to step onto. */
  public path: readonly TileCoord[] = [];
  public pathIndex = 0;
  /** Where the current walk leads, kept for searching again when the path is blocked. */
  public goals: readonly TileCoord[] = [];

  /** A new, idle peasant standing on tile (tx, ty). */
  public constructor(
    public readonly id: number,
    public tx: number,
    public ty: number,
  ) {
    this.nextTx = tx;
    this.nextTy = ty;
  }

  /** Starts the step onto (tx, ty), taking `ticks` ticks. Call only when not already in a step. */
  public startStep(tx: number, ty: number, ticks: number): void {
    this.nextTx = tx;
    this.nextTy = ty;
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

  /** Replaces the current walk with `path` toward `goals` (both empty to stop walking after the current step). */
  public setWalk(path: readonly TileCoord[], goals: readonly TileCoord[]): void {
    this.path = path;
    this.pathIndex = 0;
    this.goals = goals;
  }
}
