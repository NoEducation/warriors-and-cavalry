import { describe, expect, it } from 'vitest';
import { MapGenerator, MAPGEN_CONFIG } from '../src/sim/MapGenerator';
import { TileType } from '../src/sim/tiles';

const generator = new MapGenerator();

describe('MapGenerator', () => {
  it('is deterministic for the same params', () => {
    const a = generator.generate({ seed: 42, width: 64, height: 64 });
    const b = generator.generate({ seed: 42, width: 64, height: 64 });
    expect(Array.from(a.map.heights)).toEqual(Array.from(b.map.heights));
    expect(Array.from(a.map.tiles)).toEqual(Array.from(b.map.tiles));
    expect(a.objectCount).toBeGreaterThan(0);
    expect(Array.from(a.objects())).toEqual(Array.from(b.objects()));
  });

  it('gives different worlds for different seeds', () => {
    const a = generator.generate({ seed: 1, width: 128, height: 128 });
    const b = generator.generate({ seed: 2, width: 128, height: 128 });
    expect(Array.from(a.map.heights)).not.toEqual(Array.from(b.map.heights));
  });

  for (const seed of [1, 2, 3, 4, 5]) {
    it(`seed ${seed} at 512 x 512: seabed no deeper than 6 below sea level, no wall at the border`, () => {
      const { map } = generator.generate({ seed, width: 512, height: 512 });
      let min = Infinity;
      for (const h of map.heights) min = Math.min(min, h);
      expect(min).toBeGreaterThanOrEqual(-6.001);
      // The forced water border must match its neighbours instead of standing up as a one-tile wall.
      let step = 0;
      for (let i = 2; i < map.width - 1; i++) {
        step = Math.max(step, Math.abs(map.heightAt(i, 1) - map.heightAt(i, 2)));
        step = Math.max(step, Math.abs(map.heightAt(1, i) - map.heightAt(2, i)));
      }
      expect(step).toBeLessThanOrEqual(0.5);
    });
  }

  for (const seed of [1, 2, 3, 4, 5]) {
    it(`seed ${seed} at 512 x 512: water border, 40-55 % land, at most 15 % rock`, () => {
      const { map } = generator.generate({ seed, width: 512, height: 512 });
      const counts = [0, 0, 0, 0, 0];
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

  for (const seed of [1, 2, 3]) {
    it(`seed ${seed} at 512 x 512: rugged peaks rise well above the hills, with steep faces`, () => {
      const { map } = generator.generate({ seed, width: 512, height: 512 });
      let max = -Infinity;
      for (const h of map.heights) max = Math.max(max, h);
      expect(max).toBeGreaterThanOrEqual(12);
      let steep = 0;
      for (let ty = 0; ty < map.height; ty++) {
        for (let tx = 0; tx < map.width; tx++) {
          if (Math.abs(map.heightAt(tx + 1, ty) - map.heightAt(tx, ty)) > 1.2) steep++;
        }
      }
      expect(steep, 'tiles with a steep face').toBeGreaterThan(300);
    });
  }

  it('generates a 512 x 512 world (terrain and trees) quickly', () => {
    const start = performance.now();
    generator.generate({ seed: 9, width: 512, height: 512 });
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it('supports non-square maps', () => {
    const { map } = generator.generate({ seed: 7, width: 64, height: 32 });
    expect(map.width).toBe(64);
    expect(map.height).toBe(32);
    expect(map.tiles.length).toBe(64 * 32);
    expect(map.heights.length).toBe(65 * 33);
  });

  it('normalises the seed to an unsigned 32-bit integer', () => {
    const { map } = generator.generate({ seed: -1, width: 16, height: 16 });
    expect(map.seed).toBe(4294967295);
  });
});

describe('MAPGEN_CONFIG', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(MAPGEN_CONFIG)).toBe(true);
  });
});
