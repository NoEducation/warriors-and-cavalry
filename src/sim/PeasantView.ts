// What render, UI and game code may read of a peasant, and the values it is described by.
import type { ResourceKind } from './ResourceKind';
import type { WalkerView } from './Walker';

/** Every peasant state, in checksum order (a state's index is what the checksum covers). */
export const PEASANT_STATES = Object.freeze(['toWork', 'working', 'toStore', 'toWorkBack', 'toTree', 'chopping'] as const);

/**
 * What a worker is doing: walking to work, working, carrying to storage, walking back to work, or (a woodcutter)
 * walking to its tree and chopping it. There is no idle state: every peasant is a worker.
 */
export type PeasantState = (typeof PEASANT_STATES)[number];

/** Resources a peasant carries. */
export interface Load {
  readonly resource: ResourceKind;
  readonly amount: number;
}

/** Read-only view of a peasant, for render, UI and game code. */
export interface PeasantView extends WalkerView {
  readonly state: PeasantState;
  readonly load: Load | null;
  /** Id of the building it works at; it is born with it and dies with it. */
  readonly workplaceId: number;
  /** The storage place it carries its load to; null when not delivering or no storage place is in reach. */
  readonly targetId: number | null;
  /** The tree a woodcutter walks to or chops; null otherwise. */
  readonly treeId: number | null;
  /** Ticks left before it searches again after a failed search; 0 when not waiting. */
  readonly waitTicks: number;
}
