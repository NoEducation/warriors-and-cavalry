// Commands that change a World, and what they report back. All plain serialisable data.
import type { MapObject } from './MapObject';
import type { ObjectKind } from './ObjectKind';

/** Why an object cannot be placed at a position. */
export type PlacementFailure = 'NotBuildable' | 'OutOfBounds' | 'BadTerrain' | 'Occupied' | 'TooSteep' | 'NeedsQuarryGround' | 'NeedsWall';

export type PlacementCheck = { readonly ok: true } | { readonly ok: false; readonly reason: PlacementFailure };

export type WorldCommand =
  | { readonly type: 'placeBuilding'; readonly kind: ObjectKind; readonly tx: number; readonly ty: number }
  | { readonly type: 'demolish'; readonly objectId: number }
  | {
      readonly type: 'placeWallLine';
      readonly fromTx: number;
      readonly fromTy: number;
      readonly toTx: number;
      readonly toTy: number;
    };

/** The command that builds a line of wall pieces. */
export type PlaceWallLineCommand = Extract<WorldCommand, { type: 'placeWallLine' }>;

/** The commands that add or remove exactly one object. */
export type ObjectCommand = Extract<WorldCommand, { type: 'placeBuilding' | 'demolish' }>;

/** A successful `placeBuilding` or `demolish`: the object that was added or removed. */
export interface ObjectCommandSuccess {
  readonly ok: true;
  readonly object: MapObject;
}

/**
 * A successful `placeWallLine`: `placed` pieces were built; `skipped` walked tiles failed a placement rule before
 * placing stopped; `unpaid` valid tiles, from the first one the stone did not cover to the end of the line, were not
 * built.
 */
export interface WallLineSuccess {
  readonly ok: true;
  readonly placed: number;
  readonly skipped: number;
  readonly unpaid: number;
}

/** Why a command failed. */
export interface CommandFailure {
  readonly ok: false;
  readonly reason: PlacementFailure | 'NotEnoughResources' | 'UnknownObject' | 'NotDemolishable' | 'UnknownCommand';
}

/** What `placeBuilding` and `demolish` report. */
export type ObjectCommandResult = ObjectCommandSuccess | CommandFailure;

/**
 * What a command reports. `NotEnoughResources` means the placement fits but its cost cannot be paid;
 * `UnknownCommand` means the command's `type` is not recognised or its fields are malformed (a wall line whose
 * coordinates are not safe integers).
 */
export type CommandResult = ObjectCommandSuccess | WallLineSuccess | CommandFailure;

/** Delivered to World listeners for every object added or removed. */
export interface WorldChange {
  /** `chopped`: a round of wood was taken from the tree `object`, which still stands. */
  readonly type: 'added' | 'removed' | 'chopped';
  readonly object: MapObject;
}

/** Whether all four tile coordinates of a `placeWallLine` command are safe integers (not NaN, missing or huge). */
export function hasWholeTileCoordinates(command: PlaceWallLineCommand): boolean {
  const { fromTx, fromTy, toTx, toTy } = command;
  return [fromTx, fromTy, toTx, toTy].every((n) => Number.isSafeInteger(n));
}
