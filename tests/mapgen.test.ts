import { describe, expect, it } from 'vitest';
import { generateMap, MAPGEN_CONFIG, mapChecksum } from '../src/sim/mapgen';
import { TileType } from '../src/sim/tiles';

describe('generateMap', () => {
  it('is deterministic for the same params', () => {
    const a = generateMap({ seed: 42, width: 64, height: 64 });
    const b = generateMap({ seed: 42, width: 64, height: 64 });
    expect(Array.from(a.heights)).toEqual(Array.from(b.heights));
    expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
    expect(mapChecksum(a)).toBe(mapChecksum(b));
  });

  it('gives different maps for different seeds', () => {
    const a = generateMap({ seed: 1, width: 128, height: 128 });
    const b = generateMap({ seed: 2, width: 128, height: 128 });
    expect(mapChecksum(a)).not.toBe(mapChecksum(b));
  });

  for (const seed of [1, 2, 3, 4, 5]) {
    it(`seed ${seed}: water border, enough grass and water, valid tile values`, () => {
      const map = generateMap({ seed, width: 128, height: 128 });
      let grass = 0;
      let water = 0;
      for (let ty = 0; ty < map.height; ty++) {
        for (let tx = 0; tx < map.width; tx++) {
          const t = map.tileAt(tx, ty);
          expect(t).toBeGreaterThanOrEqual(0);
          expect(t).toBeLessThanOrEqual(3);
          if (tx === 0 || ty === 0 || tx === map.width - 1 || ty === map.height - 1) {
            expect(t, `border tile (${tx}, ${ty})`).toBe(TileType.Water);
          }
          if (t === TileType.Grass) grass++;
          if (t === TileType.Water) water++;
        }
      }
      expect(grass).toBeGreaterThanOrEqual(500);
      expect(water).toBeGreaterThanOrEqual(500);
    });
  }

  it('supports non-square maps', () => {
    const map = generateMap({ seed: 7, width: 64, height: 32 });
    expect(map.width).toBe(64);
    expect(map.height).toBe(32);
    expect(map.tiles.length).toBe(64 * 32);
    expect(map.heights.length).toBe(65 * 33);
  });

  it('normalises the seed to an unsigned 32-bit integer', () => {
    const map = generateMap({ seed: -1, width: 16, height: 16 });
    expect(map.seed).toBe(4294967295);
  });
});

describe('MAPGEN_CONFIG', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(MAPGEN_CONFIG)).toBe(true);
  });
});
