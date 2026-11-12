// The camp's stock of each resource and how much of it can be stored.
import { RESOURCE_KINDS, type ResourceAmounts, type ResourceKind, resources } from './ResourceKind';

/** Economy tuning. Frozen so worlds stay reproducible; tune by editing these values here. */
export const ECONOMY_CONFIG = Object.freeze({
  /** Capacity the camp has without any storage building. */
  baseCapacity: resources(100, 100, 100),
  /** What a new world starts with. */
  startAmounts: resources(100, 40, 50),
  /** Demolishing refunds `floor(cost / refundDivisor)` of each resource. */
  refundDivisor: 2,
});

/** Read-only view of the economy, for render, UI and game code. */
export interface EconomyView {
  /** How much of `kind` is stored. */
  amount(kind: ResourceKind): number;
  /** How much of `kind` can be stored at most. */
  capacity(kind: ResourceKind): number;
  /** True when every amount covers `cost`. */
  canAfford(cost: ResourceAmounts): boolean;
  /** The first resource (in `RESOURCE_KINDS` order) that falls short of `cost`, or null when it can be paid. */
  missing(cost: ResourceAmounts): ResourceKind | null;
}

/**
 * Whole-number amounts and capacities per resource; an amount is always between 0 and its capacity.
 * Only `World` calls the mutators (`spend`, `add`, `refund`, `addCapacity`, `removeCapacity`).
 */
export class Economy implements EconomyView {
  private readonly amounts: number[] = [];
  private readonly capacities: number[] = [];

  /** Starts at the base capacity holding `start` (clamped to that capacity). Worlds use the default start amounts. */
  public constructor(start: ResourceAmounts = ECONOMY_CONFIG.startAmounts) {
    for (const kind of RESOURCE_KINDS) {
      this.capacities[kind] = ECONOMY_CONFIG.baseCapacity[kind];
      this.amounts[kind] = Math.max(0, Math.min(start[kind], this.capacities[kind]));
    }
  }

  /** How much of `kind` is stored. */
  public amount(kind: ResourceKind): number {
    return this.amounts[kind];
  }

  /** How much of `kind` can be stored at most. */
  public capacity(kind: ResourceKind): number {
    return this.capacities[kind];
  }

  /** True when every amount covers `cost`. */
  public canAfford(cost: ResourceAmounts): boolean {
    return this.missing(cost) === null;
  }

  /** The first resource (in `RESOURCE_KINDS` order) that falls short of `cost`, or null when it can be paid. */
  public missing(cost: ResourceAmounts): ResourceKind | null {
    for (const kind of RESOURCE_KINDS) {
      if (cost[kind] > this.amounts[kind]) return kind;
    }
    return null;
  }

  /** Pays `cost` when every resource covers it and returns true; otherwise changes nothing and returns false. */
  public spend(cost: ResourceAmounts): boolean {
    if (!this.canAfford(cost)) return false;
    for (const kind of RESOURCE_KINDS) this.amounts[kind] -= cost[kind];
    return true;
  }

  /** Stores up to `amount` of `kind`; whatever exceeds the capacity is lost. Returns how much was stored. */
  public add(kind: ResourceKind, amount: number): number {
    const stored = Math.max(0, Math.min(amount, this.capacities[kind] - this.amounts[kind]));
    this.amounts[kind] += stored;
    return stored;
  }

  /** Adds back `floor(cost / refundDivisor)` of each resource, limited by capacity. Call when a building is demolished. */
  public refund(cost: ResourceAmounts): void {
    for (const kind of RESOURCE_KINDS) this.add(kind, Math.floor(cost[kind] / ECONOMY_CONFIG.refundDivisor));
  }

  /** Adds a storage building's `storage` to the capacities. Call when the building is added. */
  public addCapacity(storage: ResourceAmounts): void {
    for (const kind of RESOURCE_KINDS) this.capacities[kind] += storage[kind];
  }

  /** Removes a storage building's `storage` from the capacities; amounts above the new capacity are lost. */
  public removeCapacity(storage: ResourceAmounts): void {
    for (const kind of RESOURCE_KINDS) {
      this.capacities[kind] -= storage[kind];
      this.amounts[kind] = Math.min(this.amounts[kind], this.capacities[kind]);
    }
  }
}
