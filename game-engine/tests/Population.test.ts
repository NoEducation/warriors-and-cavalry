import { describe, expect, it } from 'vitest';
import { GameMap } from '../src/sim/GameMap';
import type { MapObject } from '../src/sim/MapObject';
import { OBJECT_KINDS, ObjectKind } from '../src/sim/ObjectKind';
import { POPULATION_CONFIG } from '../src/sim/populationConfig';
import { ResourceKind } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';
import type { ObjectCommandResult } from '../src/sim/WorldCommand';

const SIZE = 16;

/** A flat grass map; tiles for which `water` holds are water instead. */
function flatMap(size = SIZE, water: (tx: number, ty: number) => boolean = () => false): GameMap {
  const tiles = new Uint8Array(size * size).fill(TileType.Grass);
  for (let ty = 0; ty < size; ty++) for (let tx = 0; tx < size; tx++) if (water(tx, ty)) tiles[ty * size + tx] = TileType.Water;
  return new GameMap(size, size, 1, new Float32Array((size + 1) * (size + 1)), tiles);
}

function ticks(target: { tick(): void }, n: number): void {
  for (let i = 0; i < n; i++) target.tick();
}

function placed(result: ObjectCommandResult): MapObject {
  if (!result.ok) throw new Error(`placement failed: ${result.reason}`);
  return result.object;
}

const place = (world: World, kind: ObjectKind, tx: number, ty: number): MapObject =>
  placed(world.apply({ type: 'placeBuilding', kind, tx, ty }));

const food = (world: World): number => world.economy.amount(ResourceKind.Food);

const status = (world: World, id: number): string | undefined => world.productionState(id)?.status;

/** The workplace ids of all peasants, in peasant id order. */
const workplaces = (world: World): (number | null)[] => [...world.peasants()].map((p) => p.workplaceId);

/** A Keep at (2, 2) and `n` woodcutter's huts in a row at ty 12 on a 32 x 32 map, all spawned (no cost). */
function hutCamp(n: number): { world: World; keep: MapObject; huts: MapObject[] } {
  const world = new World(flatMap(32));
  const keep = world.spawn(ObjectKind.Keep, 2, 2);
  const huts = Array.from({ length: n }, (_, i) => world.spawn(ObjectKind.WoodcutterHut, 2 + 3 * i, 12));
  return { world, keep, huts };
}

describe('OBJECT_KINDS housing', () => {
  it('houses 4 in a Keep and 4 in a Hovel, nobody elsewhere', () => {
    for (const kind of Object.values(ObjectKind)) {
      const expected = kind === ObjectKind.Keep || kind === ObjectKind.Hovel ? 4 : 0;
      expect(OBJECT_KINDS[kind].housing, OBJECT_KINDS[kind].name).toBe(expected);
    }
  });
});

describe('POPULATION_CONFIG', () => {
  it('holds the stage values, with no arrival timer or food cost, and is frozen', () => {
    expect(POPULATION_CONFIG).toEqual({
      retryTicks: 50,
      retrySpread: 8,
      unreachableSkipTicks: 200,
      straightStepTicks: 4,
      diagonalStepTicks: 6,
      stumpTicks: 600,
      treeChops: 4,
    });
    expect(Object.isFrozen(POPULATION_CONFIG)).toBe(true);
  });
});

describe('World population: workers', () => {
  it('spawns nobody without a Keep', () => {
    const world = new World(flatMap());
    const hut = place(world, ObjectKind.WoodcutterHut, 8, 8);
    ticks(world, 500);
    expect(world.population).toEqual({ count: 0, housing: 0 });
    expect(status(world, hut.id)).toBe('noWorker');
  });

  it('spawns nobody for a Keep alone', () => {
    const world = new World(flatMap());
    place(world, ObjectKind.Keep, 2, 2);
    ticks(world, 500);
    expect(world.population).toEqual({ count: 0, housing: 4 });
  });

  it("spawns a hut's worker at the Keep on the next tick, heading for the hut, and spends no food", () => {
    const world = new World(flatMap());
    place(world, ObjectKind.Keep, 2, 2);
    const hut = place(world, ObjectKind.WoodcutterHut, 10, 10);
    expect(world.population.count).toBe(0);
    world.tick();
    expect(world.population).toEqual({ count: 1, housing: 4 });
    const [peasant] = [...world.peasants()];
    expect(peasant).toMatchObject({ id: 1, state: 'toWork', workplaceId: hut.id });
    expect([peasant.tx, peasant.ty]).toEqual([2, 6]); // the left end of the Keep's bottom edge
    expect(status(world, hut.id)).toBe('workerOnTheWay');
    ticks(world, 500);
    expect(food(world)).toBe(50);
  });

  it('spawns on the right edge when the bottom edge is blocked', () => {
    const world = new World(flatMap());
    world.spawn(ObjectKind.Keep, 4, 4);
    world.spawn(ObjectKind.Stockpile, 3, 8); // covers the bottom edge (tx 4..5) ...
    world.spawn(ObjectKind.Hovel, 6, 8); // ... and (tx 6..7)
    world.spawn(ObjectKind.WoodcutterHut, 12, 1);
    world.tick();
    expect([...world.peasants()][0]).toMatchObject({ tx: 8, ty: 4 }); // right edge, top first
  });

  it('spawns no more workers than the housing, lowest building id first', () => {
    const { world, huts } = hutCamp(5);
    world.tick();
    expect(world.population).toEqual({ count: 4, housing: 4 });
    expect(workplaces(world)).toEqual(huts.slice(0, 4).map((h) => h.id));
    expect(status(world, huts[4].id)).toBe('noWorker');
    ticks(world, 100);
    expect(world.population.count).toBe(4);
  });

  it('gives the waiting building its worker on the tick after a Hovel is placed', () => {
    const { world, huts } = hutCamp(5);
    world.tick();
    place(world, ObjectKind.Hovel, 20, 2);
    expect(world.population).toEqual({ count: 4, housing: 8 });
    world.tick();
    expect(world.population.count).toBe(5);
    expect(workplaces(world)[4]).toBe(huts[4].id);
  });

  it('gives every kind of production building a worker, and none to the others', () => {
    const world = new World(flatMap(32));
    world.spawn(ObjectKind.Keep, 2, 2);
    world.spawn(ObjectKind.Hovel, 8, 2);
    world.spawn(ObjectKind.Stockpile, 12, 2);
    world.spawn(ObjectKind.Granary, 16, 2);
    const farm = world.spawn(ObjectKind.WheatFarm, 2, 12);
    const hut = world.spawn(ObjectKind.WoodcutterHut, 8, 12);
    world.tick();
    expect(workplaces(world)).toEqual([farm.id, hut.id]);
  });

  it('skips a building it cannot reach from the Keep, spawning nobody for it', () => {
    const ring = (tx: number, ty: number): boolean =>
      tx >= 10 && tx <= 17 && ty >= 10 && ty <= 17 && (tx === 10 || tx === 17 || ty === 10 || ty === 17);
    const world = new World(flatMap(32, ring));
    world.spawn(ObjectKind.Keep, 2, 2);
    const hut = world.spawn(ObjectKind.WoodcutterHut, 13, 13);
    world.tick();
    expect(world.population.count).toBe(0);
    expect(status(world, hut.id)).toBe('workerCannotReach');
    expect(world.jobSkipTicks(hut.id)).toBe(200);
    ticks(world, 200); // offered again, and skipped again
    expect(world.population.count).toBe(0);
    expect(world.jobSkipTicks(hut.id)).toBe(200);
  });
});

describe('World population: a Keep built in', () => {
  it('shows workerCannotReach and skips the buildings when every tile around the Keep is built over', () => {
    const world = new World(flatMap(32));
    world.spawn(ObjectKind.Keep, 4, 4); // 4..7 x 4..7; its ring is x 3..8, y 3..8
    for (let i = 3; i <= 8; i++) {
      for (const [tx, ty] of [[i, 3], [i, 8], [3, i], [8, i]]) if (!world.objectAt(tx, ty)) world.spawn(ObjectKind.Wall, tx, ty);
    }
    const hut = world.spawn(ObjectKind.WoodcutterHut, 20, 20);
    world.tick();
    expect(world.population.count).toBe(0);
    expect(status(world, hut.id)).toBe('workerCannotReach');
    expect(world.jobSkipTicks(hut.id)).toBe(200);
  });
});

describe('World population: deaths', () => {
  it('removes the worker of a demolished workplace at once', () => {
    const { world, huts } = hutCamp(2);
    world.tick();
    world.apply({ type: 'demolish', objectId: huts[0].id });
    expect(world.population.count).toBe(1);
    expect(workplaces(world)).toEqual([huts[1].id]);
  });

  it('gives the freed place to the next waiting building on the next tick', () => {
    const { world, huts } = hutCamp(6);
    world.tick();
    expect(workplaces(world)).toEqual(huts.slice(0, 4).map((h) => h.id));
    world.apply({ type: 'demolish', objectId: huts[1].id });
    expect(world.population.count).toBe(3);
    world.tick();
    expect(world.population.count).toBe(4);
    expect(workplaces(world)).toEqual([huts[0].id, huts[2].id, huts[3].id, huts[4].id]);
    expect(status(world, huts[5].id)).toBe('noWorker');
  });

  it('kills the newest workers when a Hovel goes, and their buildings wait for room', () => {
    const { world, huts } = hutCamp(8);
    const hovel = world.spawn(ObjectKind.Hovel, 20, 2);
    world.tick();
    expect(world.population).toEqual({ count: 8, housing: 8 });
    world.apply({ type: 'demolish', objectId: hovel.id });
    expect(world.population).toEqual({ count: 4, housing: 4 });
    expect([...world.peasants()].map((p) => p.id)).toEqual([1, 2, 3, 4]);
    ticks(world, 10);
    for (const hut of huts.slice(4)) expect(status(world, hut.id)).toBe('noWorker');
    place(world, ObjectKind.Hovel, 20, 2);
    world.tick();
    expect(world.population.count).toBe(8);
  });

  it('kills nobody when the workers still fit after a Hovel goes', () => {
    const { world } = hutCamp(4);
    const hovel = world.spawn(ObjectKind.Hovel, 20, 2);
    world.tick();
    world.apply({ type: 'demolish', objectId: hovel.id });
    expect(world.population).toEqual({ count: 4, housing: 4 });
  });

  it('kills every worker when the only Keep goes, and spawns nobody after', () => {
    const { world, keep } = hutCamp(2);
    world.tick();
    world.apply({ type: 'demolish', objectId: keep.id });
    expect(world.population).toEqual({ count: 0, housing: 0 });
    ticks(world, 300);
    expect(world.population.count).toBe(0);
  });

  it('spawns at the next Keep when the first one goes', () => {
    const { world, keep } = hutCamp(1);
    const second = world.spawn(ObjectKind.Keep, 20, 2);
    world.apply({ type: 'demolish', objectId: keep.id });
    world.tick();
    const [p] = [...world.peasants()];
    expect([p.tx, p.ty]).toEqual([second.tx, second.ty + 4]);
  });
});
