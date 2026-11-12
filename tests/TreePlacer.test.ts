import { describe, expect, it } from 'vitest';
import { GameMap } from '../src/sim/GameMap';
import { MapGenerator } from '../src/sim/MapGenerator';
import { ObjectKind } from '../src/sim/ObjectKind';
import { TileType } from '../src/sim/tiles';
import { TREE_CONFIG, TreePlacer } from '../src/sim/TreePlacer';
import { World } from '../src/sim/World';

const generator = new MapGenerator();
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

describe('TreePlacer', () => {
  it('only plants on grass, in row-major order', () => {
    const size = 64;
    const tiles = new Uint8Array(size * size);
    for (let i = 0; i < tiles.length; i++) tiles[i] = i % 3 === 0 ? TileType.Grass : TileType.Sand;
    const world = new World(new GameMap(size, size, 1, new Float32Array((size + 1) * (size + 1)), tiles));
    new TreePlacer().place(world, 5);
    expect(world.objectCount).toBeGreaterThan(0);
    let lastIndex = -1;
    for (const tree of world.objects()) {
      expect(world.map.tileAt(tree.tx, tree.ty)).toBe(TileType.Grass);
      const index = tree.ty * size + tree.tx;
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it('skips occupied tiles', () => {
    const size = 32;
    const tiles = new Uint8Array(size * size).fill(TileType.Grass);
    const world = new World(new GameMap(size, size, 1, new Float32Array((size + 1) * (size + 1)), tiles));
    for (let ty = 0; ty < size; ty++) for (let tx = 0; tx < size; tx++) world.spawn(ObjectKind.Tree, tx, ty);
    expect(() => new TreePlacer().place(world, 1)).not.toThrow();
    expect(world.objectCount).toBe(size * size);
  });

  it('has a frozen config', () => {
    expect(Object.isFrozen(TREE_CONFIG)).toBe(true);
  });

  for (const seed of [1, 2, 3, 4, 5]) {
    it(`seed ${seed} at 512 x 512: trees on grass, 8-20 % cover, unique tiles, gapless ids, clustered`, () => {
      const world = generator.generate({ seed, width: 512, height: 512 });
      const { map } = world;
      let grass = 0;
      for (const t of map.tiles) if (t === TileType.Grass) grass++;
      const seen = new Set<number>();
      let expectedId = 1;
      let trees = 0;
      let clustered = 0;
      for (const object of world.objects()) {
        expect(object.id).toBe(expectedId++);
        const index = object.ty * map.width + object.tx;
        expect(seen.has(index)).toBe(false);
        seen.add(index);
        if (object.kind !== ObjectKind.Tree) continue;
        trees++;
        expect(map.tileAt(object.tx, object.ty)).toBe(TileType.Grass);
        const hasNeighbour = NEIGHBOURS.some(([dx, dy]) => world.objectAt(object.tx + dx, object.ty + dy)?.kind === ObjectKind.Tree);
        if (hasNeighbour) clustered++;
      }
      expect(expectedId - 1).toBe(world.objectCount);
      const cover = trees / grass;
      expect(cover).toBeGreaterThanOrEqual(0.08);
      expect(cover).toBeLessThanOrEqual(0.2);
      expect(clustered / trees).toBeGreaterThan(0.6);
    });
  }
});
