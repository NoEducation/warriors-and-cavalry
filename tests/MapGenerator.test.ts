import { describe, expect, it } from 'vitest';
import { MapGenerator, MAPGEN_CONFIG, mapChecksum } from '../src/sim/MapGenerator';
import { TileType } from '../src/sim/tiles';

const generator = new MapGenerator();

describe('MapGenerator', () => {
  it('is deterministic for the same params', () => {
    const a = generator.generate({ seed: 42, width: 64, height: 64 });
    const b = generator.generate({ seed: 42, width: 64, height: 64 });
    expect(Array.from(a.heights)).toEqual(Array.from(b.heights));
    expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
    expect(mapChecksum(a)).toBe(mapChecksum(b));
  });

  it('gives different maps for different seeds', () => {
    const a = generator.generate({ seed: 1, width: 128, height: 128 });
    const b = generator.generate({ seed: 2, width: 128, height: 128 });
    expect(mapChecksum(a)).not.toBe(mapChecksum(b));
  });

  for (const seed of [1, 2, 3, 4, 5]) {
    it(`seed ${seed} at 512 x 512: water border, 40-55 % land, at most 15 % rock`, () => {
      const map = generator.generate({ seed, width: 512, height: 512 });
      const counts = [0, 0, 0, 0];
      let borderLand = 0;
      for (let ty = 0; ty < map.height; ty++) {
        for (let tx = 0; tx < map.width; tx++) {
          const t = map.tiles[ty * map.width + tx];
          counts[t]++;
          const border = tx === 0 || ty === 0 || tx === map.width - 1 || ty === map.height - 1;
          if (border && t !== TileType.Water) borderLand++;
        }
      }
      const total = map.width * map.height;
      expect(counts.reduce((a, b) => a + b, 0), 'only valid tile values').toBe(total);
      expect(borderLand, 'non-water border tiles').toBe(0);
      const land = (total - counts[TileType.Water]) / total;
      expect(land).toBeGreaterThanOrEqual(0.4);
      expect(land).toBeLessThanOrEqual(0.55);
      expect(counts[TileType.Rock] / total).toBeLessThanOrEqual(0.15);
    });
  }

  it('generates a 512 x 512 map quickly', () => {
    const start = performance.now();
    generator.generate({ seed: 9, width: 512, height: 512 });
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it('supports non-square maps', () => {
    const map = generator.generate({ seed: 7, width: 64, height: 32 });
    expect(map.width).toBe(64);
    expect(map.height).toBe(32);
    expect(map.tiles.length).toBe(64 * 32);
    expect(map.heights.length).toBe(65 * 33);
  });

  it('normalises the seed to an unsigned 32-bit integer', () => {
    const map = generator.generate({ seed: -1, width: 16, height: 16 });
    expect(map.seed).toBe(4294967295);
  });
});

describe('MAPGEN_CONFIG', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(MAPGEN_CONFIG)).toBe(true);
  });
});
