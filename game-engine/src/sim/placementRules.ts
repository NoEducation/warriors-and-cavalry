// The rules for where a building may stand: buildable kind, map bounds, quarry ground, terrain, free tiles, slope.
import { Footprint } from './Footprint';
import type { GameMap } from './GameMap';
import { OBJECT_KINDS, ObjectKind, type ObjectKindInfo } from './ObjectKind';
import { TileType } from './tiles';
import type { PlacementCheck } from './WorldCommand';

/** How uneven the ground under a building may be. Frozen; tune by editing the values here. */
export const PLACEMENT_CONFIG = Object.freeze({
  /** Allowed corner height range under a footprint, per tile of its longer side (0.6 for 2 x 2, 1.2 for 4 x 4). */
  slopePerTile: 0.3,
  /** The smallest allowed corner height range, so a one-tile piece may stand on ground as uneven as a 2 x 2 building. */
  minSlopeLimit: 0.6,
});
/** Heights are stored as float32, so a range of exactly the limit can read slightly above it. */
const SLOPE_TOLERANCE = 1e-5;

/**
 * Whether a building of `kind` may stand with its footprint starting at (tx, ty) on `map`, where `isFree` says
 * whether an in-bounds footprint is unoccupied and `kindAt` what kind of object covers a tile. Checks, first failure
 * wins: NotBuildable (also for an unknown kind), OutOfBounds, NeedsQuarryGround (quarry-only kinds), BadTerrain,
 * Occupied, NeedsWall (kinds that lean on a wall), TooSteep. Does not look at resources.
 */
export function checkPlacement(
  map: GameMap,
  kind: ObjectKind,
  tx: number,
  ty: number,
  isFree: (footprint: Footprint) => boolean,
  kindAt: (tx: number, ty: number) => ObjectKind | undefined,
): PlacementCheck {
  const info: ObjectKindInfo | undefined = OBJECT_KINDS[kind];
  if (!info?.buildable) return { ok: false, reason: 'NotBuildable' };
  const footprint = Footprint.of(kind, tx, ty);
  if (!footprint.inBounds(map)) return { ok: false, reason: 'OutOfBounds' };
  if (info.quarryOnly && !allQuarryGround(map, footprint)) return { ok: false, reason: 'NeedsQuarryGround' };
  if (!info.quarryOnly && !terrainAllows(map, info, footprint)) return { ok: false, reason: 'BadTerrain' };
  if (!isFree(footprint)) return { ok: false, reason: 'Occupied' };
  if (info.needsWall && !besideWall(footprint, kindAt)) return { ok: false, reason: 'NeedsWall' };
  const range = footprint.cornerHeightRange(map);
  const limit = Math.max(PLACEMENT_CONFIG.minSlopeLimit, PLACEMENT_CONFIG.slopePerTile * Math.max(info.width, info.height));
  if (!range || range.max - range.min > limit + SLOPE_TOLERANCE) return { ok: false, reason: 'TooSteep' };
  return { ok: true };
}

/**
 * Every tile is Grass for grass-only kinds; otherwise Grass or Sand, or also Rock for rock-allowed kinds. Never
 * quarry ground, which is kept for quarries. Assumes the footprint is in bounds.
 */
function terrainAllows(map: GameMap, info: ObjectKindInfo, footprint: Footprint): boolean {
  for (const tile of footprint.tiles()) {
    const type = map.tileAt(tile.tx, tile.ty);
    if (type === TileType.Grass) continue;
    if (info.grassOnly) return false;
    if (type !== TileType.Sand && !(info.rockAllowed && type === TileType.Rock)) return false;
  }
  return true;
}

/** True when every tile of the footprint is quarry ground. Assumes the footprint is in bounds. */
function allQuarryGround(map: GameMap, footprint: Footprint): boolean {
  for (const tile of footprint.tiles()) {
    if (map.tileAt(tile.tx, tile.ty) !== TileType.Quarry) return false;
  }
  return true;
}

/** True when a tile sharing an edge with the footprint is covered by a Wall or Tower. */
function besideWall(footprint: Footprint, kindAt: (tx: number, ty: number) => ObjectKind | undefined): boolean {
  for (const tile of footprint.edgeNeighbours()) {
    const kind = kindAt(tile.tx, tile.ty);
    if (kind === ObjectKind.Wall || kind === ObjectKind.Tower) return true;
  }
  return false;
}
