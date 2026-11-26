import { describe, expect, it } from 'vitest';
import { TILE_SHADE_CONFIG, terrainTileShade } from '../src/render/terrainTileShade';
import { GameMap } from '../src/sim/GameMap';
import { TileType } from '../src/sim/tiles';

/** An 8 x 8 grass map with a 5 x 5 quarry site at (1, 1). */
function siteMap(): GameMap {
  const tiles = new Uint8Array(64).fill(TileType.Grass);
  for (let y = 1; y < 6; y++) for (let x = 1; x < 6; x++) tiles[y * 8 + x] = TileType.Quarry;
  return new GameMap(8, 8, 3, new Float32Array(81), tiles);
}

describe('terrainTileShade', () => {
  const map = siteMap();

  it('leaves other terrain alone', () => {
    expect(terrainTileShade(map, TileType.Grass, 0, 0)).toBe(1);
  });

  it('leaves the edge of a quarry site unshaded, so it blends into the land', () => {
    expect(terrainTileShade(map, TileType.Quarry, 1, 3)).toBe(1);
    expect(terrainTileShade(map, TileType.Quarry, 5, 5)).toBe(1);
  });

  it('gives inner tiles slabs of varying brightness within the slab range', () => {
    const inner = [];
    for (let y = 2; y < 5; y++) for (let x = 2; x < 5; x++) inner.push(terrainTileShade(map, TileType.Quarry, x, y));
    expect(new Set(inner).size).toBeGreaterThan(3);
    for (const v of inner) {
      expect(v).toBeGreaterThanOrEqual(TILE_SHADE_CONFIG.slabRange[0]);
      expect(v).toBeLessThanOrEqual(TILE_SHADE_CONFIG.slabRange[1]);
    }
  });
});
