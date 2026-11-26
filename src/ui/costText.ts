// Player-facing text for an amount of resources, e.g. a building's cost. No DOM.
import { RESOURCE_KINDS, RESOURCE_NAMES, type ResourceAmounts } from '../sim/ResourceKind';

/** `50 wood, 40 stone`: every non-zero amount in resource order, or `free` when all are zero. */
export function costText(cost: ResourceAmounts): string {
  const parts = RESOURCE_KINDS.filter((kind) => cost[kind] > 0).map((kind) => `${cost[kind]} ${RESOURCE_NAMES[kind]}`);
  return parts.length > 0 ? parts.join(', ') : 'free';
}

/** `50w 40s`: like `costText` with each resource shortened to its first letter, for the compact build bar buttons. */
export function shortCostText(cost: ResourceAmounts): string {
  const parts = RESOURCE_KINDS.filter((kind) => cost[kind] > 0).map(
    (kind) => `${cost[kind]}${RESOURCE_NAMES[kind][0]}`,
  );
  return parts.length > 0 ? parts.join(' ') : 'free';
}

/** `Wall: 12 pieces, 24 stone`: how many pieces a wall drag would place and their `cost`; no cost for none. */
export function wallLineText(pieces: number, cost: ResourceAmounts): string {
  const count = `Wall: ${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`;
  return pieces > 0 ? `${count}, ${costText(cost)}` : count;
}
