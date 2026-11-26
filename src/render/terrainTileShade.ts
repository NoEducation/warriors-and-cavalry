// Brightness of a whole terrain tile on top of its corner colours: quarry ground is cut into slabs with a dark rim.
import type { GameMap } from '../sim/GameMap';
import { hash2 } from '../sim/rng';
import { TileType } from '../sim/tiles';

/** Tile shading tuning. Tune by editing these values. */
export const TILE_SHADE_CONFIG = Object.freeze({
  /** Brightness range of quarry slabs, one per tile. */
  slabRange: [0.84, 1.1],
  /** Brightness of quarry tiles on the edge of their site, the cut rim that outlines it. */
  quarryRim: 0.68,
  slabSalt: 0x51ab,
});

/** Multiplier for every vertex colour of tile (tx, ty) of `type`; 1 for terrain without tile-level detail. Pure. */
export function terrainTileShade(map: GameMap, type: TileType, tx: number, ty: number): number {
  if (type !== TileType.Quarry) return 1;
  const c = TILE_SHADE_CONFIG;
  const isQuarry = (x: number, y: number): boolean => map.tileAt(x, y) === TileType.Quarry;
  if (!isQuarry(tx - 1, ty) || !isQuarry(tx + 1, ty) || !isQuarry(tx, ty - 1) || !isQuarry(tx, ty + 1)) return c.quarryRim;
  return c.slabRange[0] + (c.slabRange[1] - c.slabRange[0]) * hash2((map.seed ^ c.slabSalt) | 0, tx, ty);
}
