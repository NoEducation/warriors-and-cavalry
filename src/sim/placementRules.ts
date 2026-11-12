// The rules for where a building may stand: buildable kind, map bounds, terrain, free tiles, slope, nearby rock.
import { Footprint } from './Footprint';
import type { GameMap } from './GameMap';
import { OBJECT_KINDS, type ObjectKind, type ObjectKindInfo } from './ObjectKind';
import { TileType } from './tiles';
import type { PlacementCheck } from './WorldCommand';

/** Allowed corner height range under a footprint, per tile of its longer side (0.6 for 2 x 2, 1.2 for 4 x 4). */
export const SLOPE_PER_TILE = 0.3;
/** Heights are stored as float32, so a range of exactly the limit can read slightly above it. */
const SLOPE_TOLERANCE = 1e-5;

/**
 * Whether a building of `kind` may stand with its footprint starting at (tx, ty) on `map`, where `isFree` says
 * whether an in-bounds footprint is unoccupied. Checks, first failure wins: NotBuildable (also for an unknown kind),
 * OutOfBounds, BadTerrain, Occupied, TooSteep, NeedsRock. Does not look at resources.
 */
export function checkPlacement(
  map: GameMap,
  kind: ObjectKind,
  tx: number,
  ty: number,
  isFree: (footprint: Footprint) => boolean,
): PlacementCheck {
  const info: ObjectKindInfo | undefined = OBJECT_KINDS[kind];
  if (!info?.buildable) return { ok: false, reason: 'NotBuildable' };
  const footprint = Footprint.of(kind, tx, ty);
  if (!footprint.inBounds(map)) return { ok: false, reason: 'OutOfBounds' };
  if (!terrainAllows(map, info, footprint)) return { ok: false, reason: 'BadTerrain' };
  if (!isFree(footprint)) return { ok: false, reason: 'Occupied' };
  const range = footprint.cornerHeightRange(map);
  const limit = SLOPE_PER_TILE * Math.max(info.width, info.height);
  if (!range || range.max - range.min > limit + SLOPE_TOLERANCE) return { ok: false, reason: 'TooSteep' };
  if (info.needsRock && !touchesRock(map, footprint)) return { ok: false, reason: 'NeedsRock' };
  return { ok: true };
}

/** Every tile is Grass, or Grass or Sand for kinds that are not grass-only. Assumes the footprint is in bounds. */
function terrainAllows(map: GameMap, info: ObjectKindInfo, footprint: Footprint): boolean {
  for (const tile of footprint.tiles()) {
    const type = map.tileAt(tile.tx, tile.ty);
    if (type !== TileType.Grass && (info.grassOnly || type !== TileType.Sand)) return false;
  }
  return true;
}

/** True when at least one in-bounds edge neighbour of the footprint is Rock. */
function touchesRock(map: GameMap, footprint: Footprint): boolean {
  for (const tile of footprint.edgeNeighbours()) {
    if (map.tileAt(tile.tx, tile.ty) === TileType.Rock) return true;
  }
  return false;
}
