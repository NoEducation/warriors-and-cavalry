import { describe, expect, it } from 'vitest';
import { MapGenerator, MAPGEN_CONFIG, worldChecksum } from '../src/sim/MapGenerator';
import { ObjectKind } from '../src/sim/ObjectKind';
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
    expect(worldChecksum(a)).toBe(worldChecksum(b));
  });

  it('gives different worlds for different seeds', () => {
    const a = generator.generate({ seed: 1, width: 128, height: 128 });
    const b = generator.generate({ seed: 2, width: 128, height: 128 });
    expect(worldChecksum(a)).not.toBe(worldChecksum(b));
  });

  for (const seed of [1, 2, 3, 4, 5]) {
    it(`seed ${seed} at 512 x 512: water border, 40-55 % land, at most 15 % rock`, () => {
      const { map } = generator.generate({ seed, width: 512, height: 512 });
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

describe('worldChecksum', () => {
  it('changes after a building is placed', () => {
    const world = generator.generate({ seed: 3, width: 64, height: 64 });
    const before = worldChecksum(world);
    let placed = false;
    for (let ty = 0; ty < world.map.height && !placed; ty++) {
      for (let tx = 0; tx < world.map.width && !placed; tx++) {
        placed = world.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx, ty }).ok;
      }
    }
    expect(placed, 'found a buildable spot').toBe(true);
    expect(worldChecksum(world)).not.toBe(before);
  });
});

describe('MAPGEN_CONFIG', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(MAPGEN_CONFIG)).toBe(true);
  });
});
