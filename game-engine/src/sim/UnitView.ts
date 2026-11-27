// What render, UI and game code may read of a soldier or raider, and the values it is described by.
import type { Side, UnitKind } from './UnitKind';
import type { WalkerView } from './Walker';

/** Every order, in checksum order. Raiders are always `idle` (they pick their own targets). */
export const UNIT_ORDERS = Object.freeze(['idle', 'move', 'attack'] as const);

/**
 * A player soldier's order: standing and fighting what comes into sight, walking to a tile (ignoring enemies), or
 * attacking a named raider.
 */
export type UnitOrder = (typeof UNIT_ORDERS)[number];

/** Every target type, in checksum order. */
export const TARGET_TYPES = Object.freeze(['unit', 'peasant', 'building'] as const);

/** What a unit is going for: a unit, a peasant or a building, by id. */
export interface UnitTarget {
  readonly type: (typeof TARGET_TYPES)[number];
  readonly id: number;
}

/** Read-only view of a unit. */
export interface UnitView extends WalkerView {
  readonly side: Side;
  readonly kind: UnitKind;
  /** At 0 or below it is dead (it is removed at the end of the tick). */
  readonly hitPoints: number;
  /** Ticks until it may strike again; 0 when ready. */
  readonly cooldown: number;
  readonly order: UnitOrder;
  /** What it walks to or strikes; null when it has none. */
  readonly target: UnitTarget | null;
  /** The tick of its last strike; -1 before its first. */
  readonly lastStrikeTick: number;
  /** Ticks left before it searches again after a failed search; 0 when not waiting. */
  readonly waitTicks: number;
  /** The tile a `move` order walks it to. */
  readonly moveTx: number;
  readonly moveTy: number;
  /** The tile its target stood on when its walk toward it was planned (a chase re-plans when it moves). */
  readonly chaseTx: number;
  readonly chaseTy: number;
  /** A unit or peasant it gave up chasing (out of reach), skipped until `ignoreTicks` run out; 0 for none. */
  readonly ignoreId: number;
  readonly ignoreTicks: number;
}
