import { describe, expect, it } from 'vitest';
import { GameMap } from '../src/sim/GameMap';
import { TILE_NAMES, TileType } from '../src/sim/tiles';

// 2x2 tiles -> 3x3 corners with heights 0..8, row-major.
function makeMap(): GameMap {
  const heights = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const tiles = new Uint8Array([0, 1, 2, 3]);
  return new GameMap(2, 2, 123, heights, tiles);
}

describe('TileType', () => {
  it('names every tile type', () => {
    expect(TILE_NAMES[TileType.Water]).toBe('Water');
    expect(TILE_NAMES[TileType.Sand]).toBe('Sand');
    expect(TILE_NAMES[TileType.Grass]).toBe('Grass');
    expect(TILE_NAMES[TileType.Rock]).toBe('Rock');
  });
});

describe('GameMap', () => {
  it('stores its dimensions and seed', () => {
    const map = makeMap();
    expect(map.width).toBe(2);
    expect(map.height).toBe(2);
    expect(map.seed).toBe(123);
  });

  it('rejects wrong array lengths', () => {
    const tiles = new Uint8Array(4);
    expect(() => new GameMap(2, 2, 1, new Float32Array(8), tiles)).toThrow(RangeError);
    expect(() => new GameMap(2, 2, 1, new Float32Array(9), new Uint8Array(5))).toThrow(RangeError);
  });

  it('checks bounds', () => {
    const map = makeMap();
    expect(map.inBounds(0, 0)).toBe(true);
    expect(map.inBounds(1, 1)).toBe(true);
    expect(map.inBounds(-1, 0)).toBe(false);
    expect(map.inBounds(2, 0)).toBe(false);
    expect(map.inBounds(0, 2)).toBe(false);
    expect(map.inBounds(0.5, 0)).toBe(false);
  });

  it('reads tiles', () => {
    const map = makeMap();
    expect(map.tileAt(1, 1)).toBe(TileType.Rock);
    expect(map.tileAt(1, 0)).toBe(TileType.Sand);
    expect(map.tileAt(2, 0)).toBeUndefined();
  });

  it('reads corner heights', () => {
    const map = makeMap();
    expect(map.heightAt(2, 2)).toBe(8);
    expect(map.heightAt(1, 0)).toBe(1);
    expect(() => map.heightAt(3, 0)).toThrow(RangeError);
    expect(() => map.heightAt(0, -1)).toThrow(RangeError);
  });

  it('averages the four corners for tile height', () => {
    const map = makeMap();
    expect(map.tileHeight(0, 0)).toBe(2);
    expect(map.tileHeight(1, 1)).toBe(6);
    expect(() => map.tileHeight(2, 0)).toThrow(RangeError);
  });
});
