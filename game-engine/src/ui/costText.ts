// Player-facing text for an amount of resources, e.g. a building's cost. No DOM.
import { RESOURCE_KINDS, RESOURCE_NAMES, type ResourceAmounts, type ResourceKind } from '../sim/ResourceKind';

/** One resource of a cost and how much of it. */
export interface CostPart {
  readonly kind: ResourceKind;
  readonly amount: number;
}

/** `50 wood, 40 stone`: every non-zero amount in resource order, or `free` when all are zero. */
export function costText(cost: ResourceAmounts): string {
  const parts = RESOURCE_KINDS.filter((kind) => cost[kind] > 0).map((kind) => `${cost[kind]} ${RESOURCE_NAMES[kind]}`);
  return parts.length > 0 ? parts.join(', ') : 'free';
}

/** Every non-zero amount of `cost` with its resource, in resource order; empty when free. For icon cost lines. */
export function costParts(cost: ResourceAmounts): readonly CostPart[] {
  return RESOURCE_KINDS.filter((kind) => cost[kind] > 0).map((kind) => ({ kind, amount: cost[kind] }));
}

/** `Wall: 12 pieces, 24 stone`: how many pieces a wall drag would place and their `cost`; no cost for none. */
export function wallLineText(pieces: number, cost: ResourceAmounts): string {
  const count = `Wall: ${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`;
  return pieces > 0 ? `${count}, ${costText(cost)}` : count;
}
