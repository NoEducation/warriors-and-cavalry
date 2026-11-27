// What anything that walks the tile grid has: where it stands, its current step and walk, and the step transitions.
import type { TileCoord } from './TileCoord';
import type { WalkMode } from './walkRules';

/** The walking fields a walker shows to everyone. Peasants and units both have them. */
export interface WalkerView {
  readonly id: number;
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
  /** The tiles of the current walk; `path[pathIndex]` is the next one to step onto. */
  readonly path: readonly TileCoord[];
  readonly pathIndex: number;
  /** How its current walk may use the wall walk (see `WalkMode`). */
  readonly walkMode: WalkMode;
}

/** A walker `StepWalker` can move: its view plus the transitions that change its walk. */
export interface Walker extends WalkerView {
  /** Replaces the current walk with `path` (empty to stop after the current step), walked in `mode`. */
  startWalk(path: readonly TileCoord[], mode?: WalkMode): void;
  /** Starts the step onto the next tile of its walk, taking `ticks` ticks. Call only between steps, with tiles left. */
  stepToNextTile(ticks: number): void;
  /** Advances the current step by one tick; on its last tick it stands on the next tile and stops moving. */
  advanceStep(): void;
}
