// Kinds of soldiers, the two sides that fight, and what each kind costs and can do.
import { type ResourceAmounts, resources } from './ResourceKind';

export const UnitKind = { Spearman: 1, Archer: 2 } as const;
export type UnitKind = (typeof UnitKind)[keyof typeof UnitKind];

/** Every unit kind, in display and checksum order. */
export const UNIT_KIND_LIST: readonly UnitKind[] = Object.freeze([UnitKind.Spearman, UnitKind.Archer]);

/** Who a unit fights for: the player, or the raiders who attack the camp. */
export const Side = { Player: 0, Raider: 1 } as const;
export type Side = (typeof Side)[keyof typeof Side];

/** Static description of a unit kind. Distances are whole tiles, measured as `max(|dx|, |dy|)`. */
export interface UnitKindInfo {
  readonly name: string;
  /** Paid at the Barracks when the soldier is queued. */
  readonly cost: ResourceAmounts;
  /** Ticks of training before it steps out of the Barracks. */
  readonly trainTicks: number;
  readonly hitPoints: number;
  /** Hit points one strike takes. */
  readonly damage: number;
  /** Ticks from one strike to the next. */
  readonly strikeTicks: number;
  /** Farthest distance it strikes at (on the ground). */
  readonly reach: number;
  /** Farthest distance it notices enemies at. */
  readonly sight: number;
}

/** Frozen; tune by editing the source. */
export const UNIT_KINDS: Readonly<Record<UnitKind, UnitKindInfo>> = Object.freeze({
  [UnitKind.Spearman]: Object.freeze({
    name: 'Spearman',
    cost: resources(5, 0, 10),
    trainTicks: 100,
    hitPoints: 60,
    damage: 10,
    strikeTicks: 10,
    reach: 1,
    sight: 6,
  }),
  [UnitKind.Archer]: Object.freeze({
    name: 'Archer',
    cost: resources(10, 0, 12),
    trainTicks: 120,
    hitPoints: 35,
    damage: 6,
    strikeTicks: 15,
    reach: 6,
    sight: 8,
  }),
});

/** True when `value` names a unit kind (a command's field may be anything). */
export function isUnitKind(value: unknown): value is UnitKind {
  return value === UnitKind.Spearman || value === UnitKind.Archer;
}
