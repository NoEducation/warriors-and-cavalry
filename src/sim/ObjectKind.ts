// Kinds of objects that stand on map tiles, with their footprints.

export const ObjectKind = { Tree: 1, Keep: 2, Hovel: 3, WoodcutterHut: 4 } as const;
export type ObjectKind = (typeof ObjectKind)[keyof typeof ObjectKind];

/** Static description of an object kind. The footprint is `width` x `height` tiles from the object's (tx, ty). */
export interface ObjectKindInfo {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** True when players may place it with a `placeBuilding` command (and demolish it). */
  readonly buildable: boolean;
}

export const OBJECT_KINDS: Record<ObjectKind, ObjectKindInfo> = Object.freeze({
  [ObjectKind.Tree]: { name: 'Tree', width: 1, height: 1, buildable: false },
  [ObjectKind.Keep]: { name: 'Keep', width: 4, height: 4, buildable: true },
  [ObjectKind.Hovel]: { name: 'Hovel', width: 2, height: 2, buildable: true },
  [ObjectKind.WoodcutterHut]: { name: "Woodcutter's hut", width: 2, height: 2, buildable: true },
});
