import { describe, expect, it } from 'vitest';
import { GameMap } from '../src/sim/GameMap';
import { MapGenerator } from '../src/sim/MapGenerator';
import { ObjectKind } from '../src/sim/ObjectKind';
import { TreePlacer } from '../src/sim/TreePlacer';
import { worldChecksum } from '../src/sim/worldChecksum';

const generator = new MapGenerator();
const params = { seed: 7, width: 96, height: 96 };

describe('MapGenerator layout', () => {
  it('builds the same world from a layout as generate does', () => {
    const fromLayout = generator.buildWorld(generator.generateLayout(params));
    expect(worldChecksum(fromLayout)).toBe(worldChecksum(generator.generate(params)));
  });

  it('builds the same world from a layout whose arrays were copied, as after crossing to another thread', () => {
    const { map, treeTiles } = generator.generateLayout(params);
    const copy = new GameMap(map.width, map.height, map.seed, map.heights.slice(), map.tiles.slice());
    const world = generator.buildWorld({ map: copy, treeTiles: treeTiles.slice() });
    expect(worldChecksum(world)).toBe(worldChecksum(generator.generate(params)));
  });

  it('plans one tree per planned tile, in ascending tile order', () => {
    const { map, treeTiles } = generator.generateLayout(params);
    expect(treeTiles.length).toBeGreaterThan(0);
    for (let i = 1; i < treeTiles.length; i++) expect(treeTiles[i]).toBeGreaterThan(treeTiles[i - 1]);
    const world = generator.buildWorld({ map, treeTiles });
    const trees = Array.from(world.objects()).filter((o) => o.kind === ObjectKind.Tree);
    expect(trees.map((t) => t.ty * map.width + t.tx)).toEqual(Array.from(treeTiles));
  });

  it('plans the trees place spawns', () => {
    const { map } = generator.generateLayout(params);
    expect(new TreePlacer().plan(map, map.seed)).toEqual(generator.generateLayout(params).treeTiles);
  });
});
