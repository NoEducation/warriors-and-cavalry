// The order in which a building's access tiles are tried when someone steps out of it (a worker at the Keep, a
// soldier at the Barracks).
import type { MapObject } from './MapObject';
import { OBJECT_KINDS } from './ObjectKind';
import type { TileCoord } from './TileCoord';

/** What `firstAccessTile` needs to know of the world. */
export interface AccessTileSource {
  readonly map: { readonly width: number; readonly height: number };
  accessTiles(objectId: number): TileCoord[];
}

/**
 * The first walkable access tile of `building` in the order bottom edge left to right, right edge top to bottom,
 * top edge left to right, left edge top to bottom; null when none is walkable.
 */
export function firstAccessTile(world: AccessTileSource, building: MapObject): TileCoord | null {
  const { width, height } = OBJECT_KINDS[building.kind];
  const span = world.map.width + world.map.height;
  let best: TileCoord | null = null;
  let bestKey = Infinity;
  for (const tile of world.accessTiles(building.id)) {
    let key: number;
    if (tile.ty === building.ty + height) key = tile.tx;
    else if (tile.tx === building.tx + width) key = span + tile.ty;
    else if (tile.ty === building.ty - 1) key = 2 * span + tile.tx;
    else key = 3 * span + tile.ty;
    if (key < bestKey) [best, bestKey] = [tile, key];
  }
  return best;
}
