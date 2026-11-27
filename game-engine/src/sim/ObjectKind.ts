// Kinds of objects that stand on map tiles: footprints, costs, storage, housing, hit points, placement rules and
// production.
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
  Stairs: 13,
  Barracks: 14,
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
  /** True when one of its tiles' edge neighbours must be a Wall or Tower (stairs lean on one). */
  readonly needsWall: boolean;
  /** Peasants this building houses while it stands. */
  readonly housing: number;
  /** Soldiers the player may have (trained or queued) while it stands; see `World.soldiers`. */
  readonly soldierRoom: number;
  /** Damage it takes before it falls; 0 when it cannot be attacked (trees, stumps). */
  readonly hitPoints: number;
  readonly production: ProductionInfo | null;
}

/** Shared values of the kinds that neither store, produce nor have extra placement rules. */
const PLAIN = {
  storage: NO_RESOURCES,
  grassOnly: false,
  quarryOnly: false,
  rockAllowed: false,
  needsWall: false,
  housing: 0,
  soldierRoom: 0,
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
  [ObjectKind.Tree]: { ...PLAIN, hitPoints: 0, name: 'Tree', width: 1, height: 1, buildable: false, cost: NO_RESOURCES },
  [ObjectKind.Keep]: {
    ...PLAIN,
    hitPoints: 600,
    name: 'Keep',
    width: 4,
    height: 4,
    buildable: true,
    cost: resources(50, 40, 0),
    housing: 4,
  },
  [ObjectKind.Hovel]: {
    ...PLAIN,
    hitPoints: 80,
    name: 'Hovel',
    width: 2,
    height: 2,
    buildable: true,
    cost: resources(15, 0, 0),
    housing: 4,
  },
  [ObjectKind.WoodcutterHut]: {
    ...PLAIN,
    hitPoints: 80,
    name: "Woodcutter's hut",
    width: 2,
    height: 2,
    buildable: true,
    cost: resources(20, 0, 0),
    production: { resource: ResourceKind.Wood, cycleTicks: 100, yield: 2, treeRadius: 8 },
  },
  [ObjectKind.Stockpile]: {
    ...PLAIN,
    hitPoints: 80,
    name: 'Stockpile',
    width: 3,
    height: 3,
    buildable: true,
    cost: resources(10, 0, 0),
    storage: resources(150, 150, 0),
  },
  [ObjectKind.Granary]: {
    ...PLAIN,
    hitPoints: 120,
    name: 'Granary',
    width: 3,
    height: 3,
    buildable: true,
    cost: resources(25, 0, 0),
    storage: resources(0, 0, 200),
  },
  [ObjectKind.Quarry]: {
    ...PLAIN,
    hitPoints: 120,
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
    hitPoints: 80,
    name: 'Wheat farm',
    width: 4,
    height: 4,
    buildable: true,
    cost: resources(20, 0, 0),
    grassOnly: true,
    production: { resource: ResourceKind.Food, cycleTicks: 200, yield: 3, treeRadius: null },
  },
  [ObjectKind.Wall]: { ...CASTLE, hitPoints: 150, name: 'Wall', width: 1, height: 1, cost: resources(0, 2, 0) },
  [ObjectKind.Gate]: { ...CASTLE, hitPoints: 200, name: 'Gate', width: 1, height: 1, cost: resources(0, 6, 0) },
  [ObjectKind.Tower]: { ...CASTLE, hitPoints: 400, name: 'Tower', width: 2, height: 2, cost: resources(0, 20, 0) },
  [ObjectKind.Stump]: { ...PLAIN, hitPoints: 0, name: 'Stump', width: 1, height: 1, buildable: false, cost: NO_RESOURCES },
  [ObjectKind.Barracks]: {
    ...PLAIN,
    hitPoints: 200,
    name: 'Barracks',
    width: 3,
    height: 3,
    buildable: true,
    cost: resources(40, 10, 0),
    soldierRoom: 8,
  },
  [ObjectKind.Stairs]: { ...CASTLE, hitPoints: 60, name: 'Stairs', width: 1, height: 1, cost: resources(0, 3, 0), needsWall: true },
});
