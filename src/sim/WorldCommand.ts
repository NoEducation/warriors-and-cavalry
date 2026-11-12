// Commands that change a World, and what they report back. All plain serialisable data.
import type { MapObject } from './MapObject';
import type { ObjectKind } from './ObjectKind';

/** Why an object cannot be placed at a position. */
export type PlacementFailure = 'NotBuildable' | 'OutOfBounds' | 'BadTerrain' | 'Occupied' | 'TooSteep';

export type PlacementCheck = { readonly ok: true } | { readonly ok: false; readonly reason: PlacementFailure };

export type WorldCommand =
  | { readonly type: 'placeBuilding'; readonly kind: ObjectKind; readonly tx: number; readonly ty: number }
  | { readonly type: 'demolish'; readonly objectId: number };

/** On success, the object that was added or removed. */
export type CommandResult =
  | { readonly ok: true; readonly object: MapObject }
  | { readonly ok: false; readonly reason: PlacementFailure | 'UnknownObject' | 'NotDemolishable' };

/** Delivered to World listeners for every object added or removed. */
export interface WorldChange {
  readonly type: 'added' | 'removed';
  readonly object: MapObject;
}
