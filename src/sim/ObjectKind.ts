// Kinds of objects that stand on map tiles: footprints, costs, storage, housing, placement rules and production.
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
  Wall: 9,
  Gate: 10,
  Tower: 11,
  Stump: 12,
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
  /** True when every footprint tile must be quarry ground (which no other kind may use). */
  readonly quarryOnly: boolean;
  /** True when footprint tiles may also be Rock (walls, gates and towers, so castles can stand on hills). */
  readonly rockAllowed: boolean;
  /** Peasants this building houses while it stands. */
  readonly housing: number;
  readonly production: ProductionInfo | null;
}

/** Shared values of the kinds that neither store, produce nor have extra placement rules. */
const PLAIN = {
  storage: NO_RESOURCES,
  grassOnly: false,
  quarryOnly: false,
  rockAllowed: false,
  housing: 0,
  production: null,
} as const;

/** Shared values of the stone castle pieces: plain, buildable, and allowed on rock. */
const CASTLE = { ...PLAIN, buildable: true, rockAllowed: true } as const;

/** Freezes `value` and every object reachable from it, so no nested table entry can be changed at run time. */
function deepFreeze<T extends object>(value: T): T {
  for (const child of Object.values(value)) {
    if (typeof child === 'object' && child !== null) deepFreeze(child);
  }
  return Object.freeze(value);
}

/** Frozen all the way down (entries and their cost, storage and production); tune by editing the source. */
export const OBJECT_KINDS: Record<ObjectKind, ObjectKindInfo> = deepFreeze({
  [ObjectKind.Tree]: { ...PLAIN, name: 'Tree', width: 1, height: 1, buildable: false, cost: NO_RESOURCES },
  [ObjectKind.Keep]: {
    ...PLAIN,
    name: 'Keep',
    width: 4,
    height: 4,
    buildable: true,
    cost: resources(50, 40, 0),
    housing: 4,
  },
  [ObjectKind.Hovel]: {
    ...PLAIN,
    name: 'Hovel',
    width: 2,
    height: 2,
    buildable: true,
    cost: resources(15, 0, 0),
    housing: 4,
  },
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
    quarryOnly: true,
    production: { resource: ResourceKind.Stone, cycleTicks: 150, yield: 8, treeRadius: null },
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
  [ObjectKind.Wall]: { ...CASTLE, name: 'Wall', width: 1, height: 1, cost: resources(0, 2, 0) },
  [ObjectKind.Gate]: { ...CASTLE, name: 'Gate', width: 1, height: 1, cost: resources(0, 6, 0) },
  [ObjectKind.Tower]: { ...CASTLE, name: 'Tower', width: 2, height: 2, cost: resources(0, 20, 0) },
  [ObjectKind.Stump]: { ...PLAIN, name: 'Stump', width: 1, height: 1, buildable: false, cost: NO_RESOURCES },
});
