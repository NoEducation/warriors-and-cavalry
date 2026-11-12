// Player-facing text for an amount of resources, e.g. a building's cost. No DOM.
import { RESOURCE_KINDS, RESOURCE_NAMES, type ResourceAmounts } from '../sim/ResourceKind';

/** `50 wood, 40 stone`: every non-zero amount in resource order, or `free` when all are zero. */
export function costText(cost: ResourceAmounts): string {
  const parts = RESOURCE_KINDS.filter((kind) => cost[kind] > 0).map((kind) => `${cost[kind]} ${RESOURCE_NAMES[kind]}`);
  return parts.length > 0 ? parts.join(', ') : 'free';
}
