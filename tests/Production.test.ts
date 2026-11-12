import { describe, expect, it } from 'vitest';
import { Economy } from '../src/sim/Economy';
import { GameMap } from '../src/sim/GameMap';
import { MapGenerator } from '../src/sim/MapGenerator';
import type { MapObject } from '../src/sim/MapObject';
import { ObjectKind } from '../src/sim/ObjectKind';
import { Production } from '../src/sim/Production';
import { NO_RESOURCES, ResourceKind } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';
import type { WorldCommand } from '../src/sim/WorldCommand';
import { worldChecksum } from '../src/sim/worldChecksum';

const SIZE = 64;
const WOOD = ResourceKind.Wood;

function flatMap(): GameMap {
  const tiles = new Uint8Array(SIZE * SIZE).fill(TileType.Grass);
  return new GameMap(SIZE, SIZE, 1, new Float32Array((SIZE + 1) * (SIZE + 1)), tiles);
}

function place(world: World, kind: ObjectKind, tx: number, ty: number): MapObject {
  const result = world.apply({ type: 'placeBuilding', kind, tx, ty });
  if (!result.ok) throw new Error(`placement failed: ${result.reason}`);
  return result.object;
}

function ticks(world: World, count: number): void {
  for (let i = 0; i < count; i++) world.tick();
}

/** A flat world (holding `economy`) with a Woodcutter's hut at (20, 20) (covering 20..21) and a tree at `tree`. */
function hutWorld(tree: [number, number] | null, economy = new Economy()): { world: World; hut: MapObject } {
  const world = new World(flatMap(), economy);
  if (tree) world.spawn(ObjectKind.Tree, tree[0], tree[1]);
  return { world, hut: place(world, ObjectKind.WoodcutterHut, 20, 20) };
}

describe('Production in World.tick', () => {
  it('adds 2 wood when a Woodcutter hut near a tree completes 100 ticks', () => {
    const { world, hut } = hutWorld([24, 20]);
    expect(world.economy.amount(WOOD)).toBe(80);
    ticks(world, 99);
    expect(world.economy.amount(WOOD)).toBe(80);
    expect(world.productionState(hut.id)).toEqual({ status: 'working', progress: 99, cycleTicks: 100 });
    world.tick();
    expect(world.economy.amount(WOOD)).toBe(82);
    expect(world.productionState(hut.id)).toEqual({ status: 'working', progress: 0, cycleTicks: 100 });
  });

  it('needs a tree within 8 tiles of the footprint, counted per axis', () => {
    for (const tree of [
      [29, 20],
      [20, 29],
      [29, 29],
      [12, 12],
    ] as [number, number][]) {
      const { world, hut } = hutWorld(tree);
      expect(world.productionState(hut.id)?.status, `tree at ${tree}`).toBe('working');
    }
    for (const tree of [
      [30, 20],
      [21, 30],
      [11, 21],
      [30, 30],
    ] as [number, number][]) {
      const { world, hut } = hutWorld(tree);
      ticks(world, 500);
      expect(world.productionState(hut.id), `tree at ${tree}`).toEqual({
        status: 'noTrees',
        progress: 0,
        cycleTicks: 100,
      });
      expect(world.economy.amount(WOOD)).toBe(80);
    }
  });

  it('starts working when a tree is spawned nearby', () => {
    const { world, hut } = hutWorld(null);
    expect(world.productionState(hut.id)?.status).toBe('noTrees');
    world.spawn(ObjectKind.Tree, 25, 25);
    expect(world.productionState(hut.id)?.status).toBe('working');
  });

  it('runs a Quarry and a Wheat farm on their own cycles', () => {
    const map = flatMap();
    map.tiles[21 * SIZE + 23] = TileType.Rock; // right of the quarry's middle row
    const world = new World(map);
    const quarry = place(world, ObjectKind.Quarry, 20, 20);
    const farm = place(world, ObjectKind.WheatFarm, 40, 40);
    ticks(world, 149);
    expect(world.economy.amount(ResourceKind.Stone)).toBe(40);
    world.tick();
    expect(world.economy.amount(ResourceKind.Stone)).toBe(42);
    ticks(world, 49);
    expect(world.economy.amount(ResourceKind.Food)).toBe(50);
    world.tick();
    expect(world.economy.amount(ResourceKind.Food)).toBe(53);
    expect(world.productionState(quarry.id)).toEqual({ status: 'working', progress: 50, cycleTicks: 150 });
    expect(world.productionState(farm.id)).toEqual({ status: 'working', progress: 0, cycleTicks: 200 });
  });

  it('pauses while storage is full and resumes from the same progress', () => {
    const economy = new Economy();
    const { world, hut } = hutWorld([24, 20], economy);
    ticks(world, 30);
    economy.add(WOOD, 100);
    expect(world.economy.amount(WOOD)).toBe(100);
    ticks(world, 50);
    expect(world.productionState(hut.id)).toEqual({ status: 'storageFull', progress: 30, cycleTicks: 100 });
    place(world, ObjectKind.Hovel, 40, 40);
    expect(world.economy.amount(WOOD)).toBe(85);
    ticks(world, 69);
    expect(world.economy.amount(WOOD)).toBe(85);
    world.tick();
    expect(world.economy.amount(WOOD)).toBe(87);
  });

  it('stores only what fits when a cycle completes', () => {
    const economy = new Economy();
    const { world, hut } = hutWorld([24, 20], economy);
    economy.add(WOOD, 19);
    expect(world.economy.amount(WOOD)).toBe(99);
    ticks(world, 100);
    expect(world.economy.amount(WOOD)).toBe(100);
    expect(world.productionState(hut.id)).toEqual({ status: 'storageFull', progress: 0, cycleTicks: 100 });
  });

  it('keeps each building on its own schedule', () => {
    const { world, hut: a } = hutWorld([24, 20]);
    ticks(world, 30);
    const b = place(world, ObjectKind.WoodcutterHut, 26, 20);
    ticks(world, 70);
    expect(world.economy.amount(WOOD)).toBe(62);
    expect(world.productionState(a.id)?.progress).toBe(0);
    expect(world.productionState(b.id)?.progress).toBe(70);
    ticks(world, 30);
    expect(world.economy.amount(WOOD)).toBe(64);
    expect(world.productionState(a.id)?.progress).toBe(30);
    expect(world.productionState(b.id)?.progress).toBe(0);
  });

  it('forgets a demolished producer', () => {
    const { world, hut } = hutWorld([24, 20]);
    ticks(world, 50);
    world.apply({ type: 'demolish', objectId: hut.id });
    expect(world.productionState(hut.id)).toBeNull();
    const wood = world.economy.amount(WOOD);
    ticks(world, 300);
    expect(world.economy.amount(WOOD)).toBe(wood);
  });

  it('has no production state for buildings that do not produce, trees or unknown ids', () => {
    const world = new World(flatMap());
    const tree = world.spawn(ObjectKind.Tree, 1, 1);
    const hovel = place(world, ObjectKind.Hovel, 5, 5);
    expect(world.productionState(tree.id)).toBeNull();
    expect(world.productionState(hovel.id)).toBeNull();
    expect(world.productionState(99)).toBeNull();
  });
});

describe('Production', () => {
  it('rechecks the trees when a nearby tree is removed', () => {
    const trees = new Set(['24,20', '40,40']);
    const economy = new Economy(NO_RESOURCES); // wood below capacity, so only the trees decide
    const production = new Production(flatMap(), economy, (tx, ty) => trees.has(`${tx},${ty}`));
    const hut: MapObject = { id: 1, kind: ObjectKind.WoodcutterHut, tx: 20, ty: 20 };
    production.added(hut);
    expect(production.state(hut.id)?.status).toBe('working');
    trees.delete('40,40');
    production.removed({ id: 3, kind: ObjectKind.Tree, tx: 40, ty: 40 });
    expect(production.state(hut.id)?.status).toBe('working');
    trees.delete('24,20');
    production.removed({ id: 2, kind: ObjectKind.Tree, tx: 24, ty: 20 });
    expect(production.state(hut.id)?.status).toBe('noTrees');
    production.tick();
    expect(production.state(hut.id)?.progress).toBe(0);
  });
});

describe('Production determinism and speed', () => {
  const generator = new MapGenerator();

  /** The first spot (row-major) where a Woodcutter's hut can be placed and would work. */
  function workingHutSpot(world: World): [number, number] {
    const { width, height } = world.map;
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        if (!world.canPlace(ObjectKind.WoodcutterHut, tx, ty).ok) continue;
        const probe = generator.generate({ seed: world.map.seed, width, height });
        const hut = place(probe, ObjectKind.WoodcutterHut, tx, ty);
        if (probe.productionState(hut.id)?.status === 'working') return [tx, ty];
      }
    }
    throw new Error('no working spot');
  }

  /** Generates seed 7 and runs 1000 ticks, applying each command at its tick. */
  function run(script: [number, WorldCommand][]): number {
    const world = generator.generate({ seed: 7, width: 96, height: 96 });
    for (let tick = 0; tick < 1000; tick++) {
      for (const [at, command] of script) if (at === tick) world.apply(command);
      world.tick();
    }
    return worldChecksum(world);
  }

  it('gives equal checksums for equal commands on equal ticks, and different ones when a tick moves', () => {
    const [tx, ty] = workingHutSpot(generator.generate({ seed: 7, width: 96, height: 96 }));
    const hut: WorldCommand = { type: 'placeBuilding', kind: ObjectKind.WoodcutterHut, tx, ty };
    const script: [number, WorldCommand][] = [
      [10, hut],
      [400, { type: 'demolish', objectId: 999_999 }],
    ];
    expect(run(script)).toBe(run(script));
    expect(run([[11, hut], script[1]])).not.toBe(run(script));
  });

  it('runs a day of 20 producers on a 512 x 512 world quickly', () => {
    const world = generator.generate({ seed: 1, width: 512, height: 512 });
    // Spawned rather than placed: the start resources would pay for only a few. Spots must pass the placement rules.
    const kinds = [ObjectKind.WoodcutterHut, ObjectKind.WheatFarm];
    let producers = 0;
    for (let ty = 0; ty < 512 && producers < 20; ty += 8) {
      for (let tx = 0; tx < 512 && producers < 20; tx += 8) {
        const kind = kinds[producers % kinds.length];
        if (!world.canPlace(kind, tx, ty).ok) continue;
        world.spawn(kind, tx, ty);
        producers++;
      }
    }
    expect(producers).toBe(20);
    const start = performance.now();
    ticks(world, 2400);
    expect(performance.now() - start).toBeLessThan(200);
  });
});
