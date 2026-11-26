// What render, UI and game code may read of a peasant, and the values it is described by.
import type { ResourceKind } from './ResourceKind';
import type { TileCoord } from './TileCoord';
import type { WalkMode } from './walkRules';

/** Every peasant state, in checksum order (a state's index is what the checksum covers). */
export const PEASANT_STATES = Object.freeze(['idle', 'toWork', 'working', 'toStore', 'toWorkBack', 'toTree', 'chopping'] as const);

/**
 * What a peasant is doing: nothing, walking to work, working, carrying to storage, walking back to work, or (a
 * woodcutter) walking to its tree and chopping it.
 */
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
  /** The tree a woodcutter walks to or chops; null otherwise. */
  readonly treeId: number | null;
  /** Ticks left before it searches again after a failed search; 0 when not waiting. */
  readonly waitTicks: number;
  /** The tiles of the current walk; `path[pathIndex]` is the next one to step onto. */
  readonly path: readonly TileCoord[];
  readonly pathIndex: number;
  /** How its current walk may use the wall walk (see `WalkMode`). */
  readonly walkMode: WalkMode;
  /** The tile near the Keep an idle peasant stands on or heads for; null when it has none. */
  readonly stand: TileCoord | null;
}
