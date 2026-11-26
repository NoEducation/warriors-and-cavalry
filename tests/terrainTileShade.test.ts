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

  it('darkens the rim of a quarry site', () => {
    expect(terrainTileShade(map, TileType.Quarry, 1, 3)).toBe(TILE_SHADE_CONFIG.quarryRim);
    expect(terrainTileShade(map, TileType.Quarry, 5, 5)).toBe(TILE_SHADE_CONFIG.quarryRim);
  });

  it('gives inner tiles slabs of varying brightness, all lighter than the rim', () => {
    const inner = [];
    for (let y = 2; y < 5; y++) for (let x = 2; x < 5; x++) inner.push(terrainTileShade(map, TileType.Quarry, x, y));
    expect(new Set(inner).size).toBeGreaterThan(3);
    for (const v of inner) expect(v).toBeGreaterThan(TILE_SHADE_CONFIG.quarryRim);
  });
});
