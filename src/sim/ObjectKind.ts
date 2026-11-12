// Kinds of objects that stand on map tiles: footprints, costs, storage, placement rules and production.
import { NO_RESOURCES, type ResourceAmounts, ResourceKind, resources } from './ResourceKind';

export const ObjectKind = {
  Tree: 1,
  Keep: 2,
  Hovel: 3,
  WoodcutterHut: 4,
  Stockpile: 5,
  Granary: 6,
  Quarry: 7,
  WheatFarm: 8,
} as const;
export type ObjectKind = (typeof ObjectKind)[keyof typeof ObjectKind];

/** How a building adds a resource: `yield` of `resource` every `cycleTicks` ticks while it can work. */
export interface ProductionInfo {
  readonly resource: ResourceKind;
  readonly cycleTicks: number;
  readonly yield: number;
  /** Works only while a tree stands within this many tiles of the footprint; null when trees do not matter. */
  readonly treeRadius: number | null;
}

/** Static description of an object kind. The footprint is `width` x `height` tiles from the object's (tx, ty). */
export interface ObjectKindInfo {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** True when players may place it with a `placeBuilding` command (and demolish it). */
  readonly buildable: boolean;
  /** Paid when placed; half (rounded down) comes back when demolished. */
  readonly cost: ResourceAmounts;
  /** Added to the economy's capacity while the object stands. */
  readonly storage: ResourceAmounts;
  /** True when every footprint tile must be Grass (otherwise Grass or Sand). */
  readonly grassOnly: boolean;
  /** True when a Rock tile must touch an edge of the footprint. */
  readonly needsRock: boolean;
  readonly production: ProductionInfo | null;
}

/** Shared values of the kinds that neither store, produce nor have extra placement rules. */
const PLAIN = { storage: NO_RESOURCES, grassOnly: false, needsRock: false, production: null } as const;

export const OBJECT_KINDS: Record<ObjectKind, ObjectKindInfo> = Object.freeze({
  [ObjectKind.Tree]: { ...PLAIN, name: 'Tree', width: 1, height: 1, buildable: false, cost: NO_RESOURCES },
  [ObjectKind.Keep]: { ...PLAIN, name: 'Keep', width: 4, height: 4, buildable: true, cost: resources(50, 40, 0) },
  [ObjectKind.Hovel]: { ...PLAIN, name: 'Hovel', width: 2, height: 2, buildable: true, cost: resources(15, 0, 0) },
  [ObjectKind.WoodcutterHut]: {
    ...PLAIN,
    name: "Woodcutter's hut",
    width: 2,
    height: 2,
    buildable: true,
    cost: resources(20, 0, 0),
    production: { resource: ResourceKind.Wood, cycleTicks: 100, yield: 2, treeRadius: 8 },
  },
  [ObjectKind.Stockpile]: {
    ...PLAIN,
    name: 'Stockpile',
    width: 3,
    height: 3,
    buildable: true,
    cost: resources(10, 0, 0),
    storage: resources(150, 150, 0),
  },
  [ObjectKind.Granary]: {
    ...PLAIN,
    name: 'Granary',
    width: 3,
    height: 3,
    buildable: true,
    cost: resources(25, 0, 0),
    storage: resources(0, 0, 200),
  },
  [ObjectKind.Quarry]: {
    ...PLAIN,
    name: 'Quarry',
    width: 3,
    height: 3,
    buildable: true,
    cost: resources(30, 0, 0),
    needsRock: true,
    production: { resource: ResourceKind.Stone, cycleTicks: 150, yield: 2, treeRadius: null },
  },
  [ObjectKind.WheatFarm]: {
    ...PLAIN,
    name: 'Wheat farm',
    width: 4,
    height: 4,
    buildable: true,
    cost: resources(20, 0, 0),
    grassOnly: true,
    production: { resource: ResourceKind.Food, cycleTicks: 200, yield: 3, treeRadius: null },
  },
});
