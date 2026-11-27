// The player's resources, and amounts of them (costs, storage, stock). All amounts are whole numbers.

export const ResourceKind = { Wood: 0, Stone: 1, Food: 2 } as const;
export type ResourceKind = (typeof ResourceKind)[keyof typeof ResourceKind];

/** Every resource, in display and checksum order. */
export const RESOURCE_KINDS: readonly ResourceKind[] = Object.freeze([
  ResourceKind.Wood,
  ResourceKind.Stone,
  ResourceKind.Food,
]);

/** Lower-case names for messages, e.g. `not enough wood`. */
export const RESOURCE_NAMES: Record<ResourceKind, string> = Object.freeze({
  [ResourceKind.Wood]: 'wood',
  [ResourceKind.Stone]: 'stone',
  [ResourceKind.Food]: 'food',
});

/** A whole-number amount of every resource. */
export type ResourceAmounts = Readonly<Record<ResourceKind, number>>;

/** A frozen amount of each resource; use for costs, storage and config values. */
export function resources(wood: number, stone: number, food: number): ResourceAmounts {
  return Object.freeze({ [ResourceKind.Wood]: wood, [ResourceKind.Stone]: stone, [ResourceKind.Food]: food });
}

/** Nothing of any resource. */
export const NO_RESOURCES: ResourceAmounts = resources(0, 0, 0);
