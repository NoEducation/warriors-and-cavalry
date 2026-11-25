import { describe, expect, it } from 'vitest';
import { Economy } from '../src/sim/Economy';
import { Footprint } from '../src/sim/Footprint';
import { GameMap } from '../src/sim/GameMap';
import type { MapObject } from '../src/sim/MapObject';
import { OBJECT_KINDS, ObjectKind } from '../src/sim/ObjectKind';
import type { PeasantView } from '../src/sim/Peasant';
import { Population, type PopulationHost } from '../src/sim/Population';
import { POPULATION_CONFIG } from '../src/sim/populationConfig';
import { ResourceKind, resources } from '../src/sim/ResourceKind';
import type { TileCoord } from '../src/sim/TileCoord';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';
import type { CommandResult } from '../src/sim/WorldCommand';

const SIZE = 16;

function flatMap(): GameMap {
  const tiles = new Uint8Array(SIZE * SIZE).fill(TileType.Grass);
  return new GameMap(SIZE, SIZE, 1, new Float32Array((SIZE + 1) * (SIZE + 1)), tiles);
}

function ticks(target: { tick(): void }, n: number): void {
  for (let i = 0; i < n; i++) target.tick();
}

function placed(result: CommandResult): MapObject {
  if (!result.ok) throw new Error(`placement failed: ${result.reason}`);
  return result.object;
}

const place = (world: World, kind: ObjectKind, tx: number, ty: number): MapObject =>
  placed(world.apply({ type: 'placeBuilding', kind, tx, ty }));

const food = (world: World): number => world.economy.amount(ResourceKind.Food);

describe('OBJECT_KINDS housing', () => {
  it('houses 4 in a Keep and 4 in a Hovel, nobody elsewhere', () => {
    for (const kind of Object.values(ObjectKind)) {
      const expected = kind === ObjectKind.Keep || kind === ObjectKind.Hovel ? 4 : 0;
      expect(OBJECT_KINDS[kind].housing, OBJECT_KINDS[kind].name).toBe(expected);
    }
  });
});

describe('POPULATION_CONFIG', () => {
  it('holds the stage values and is frozen', () => {
    expect(POPULATION_CONFIG).toEqual({
      arrivalTicks: 50,
      arrivalFoodCost: 5,
      retryTicks: 50,
      unreachableSkipTicks: 200,
      straightStepTicks: 4,
      diagonalStepTicks: 6,
    });
    expect(Object.isFrozen(POPULATION_CONFIG)).toBe(true);
  });
});

describe('World population: arrivals', () => {
  it('brings nobody without a Keep and spends no food', () => {
    const world = new World(flatMap());
    ticks(world, 500);
    expect(world.population).toEqual({ count: 0, housing: 0, idle: 0 });
    expect(food(world)).toBe(50);
  });

  it('brings one peasant 50 ticks after the Keep is placed, onto the left end of its bottom edge', () => {
    const world = new World(flatMap());
    place(world, ObjectKind.Keep, 2, 2);
    ticks(world, 49);
    expect(world.population.count).toBe(0);
    expect(world.arrivalTimer).toBe(49);
    world.tick();
    expect(world.population).toEqual({ count: 1, housing: 4, idle: 1 });
    expect(world.arrivalTimer).toBe(0);
    expect(food(world)).toBe(45);
    const [peasant] = [...world.peasants()];
    expect(peasant).toMatchObject({ id: 1, state: 'idle', tx: 2, ty: 6, nextTx: 2, nextTy: 6, stepTicks: 0 });
    expect(peasant.load).toBeNull();
    expect(peasant.workplaceId).toBeNull();
  });

  it('uses the right, top and left edges in turn when the earlier edges are blocked', () => {
    const world = new World(flatMap());
    world.spawn(ObjectKind.Keep, 4, 4);
    for (let tx = 4; tx < 8; tx++) world.spawn(ObjectKind.Tree, tx, 8); // trees are walkable: still the bottom
    ticks(world, 50);
    expect([...world.peasants()][0]).toMatchObject({ tx: 4, ty: 8 });

    const blocked = new World(flatMap());
    blocked.spawn(ObjectKind.Keep, 4, 4);
    blocked.spawn(ObjectKind.Stockpile, 3, 8); // covers the whole bottom edge (tx 4..5) ...
    blocked.spawn(ObjectKind.Hovel, 6, 8); // ... and (tx 6..7)
    ticks(blocked, 50);
    expect([...blocked.peasants()][0]).toMatchObject({ tx: 8, ty: 4 }); // right edge, top first
  });

  it('fills the housing and stops, and a Hovel lets arrivals resume', () => {
    const world = new World(flatMap());
    place(world, ObjectKind.Keep, 2, 2);
    ticks(world, 400);
    expect(world.population).toEqual({ count: 4, housing: 4, idle: 4 });
    expect(food(world)).toBe(30);
    expect(world.arrivalTimer).toBe(0);
    expect([...world.peasants()].map((p) => p.id)).toEqual([1, 2, 3, 4]);
    place(world, ObjectKind.Hovel, 10, 10);
    expect(world.population.housing).toBe(8);
    ticks(world, 50);
    expect(world.population.count).toBe(5);
    expect(food(world)).toBe(25);
  });

  it('brings nobody and keeps the timer at 0 while food is short', () => {
    const world = new World(flatMap(), new Economy(resources(100, 40, 4)));
    place(world, ObjectKind.Keep, 2, 2);
    for (let i = 0; i < 200; i++) {
      world.tick();
      expect(world.arrivalTimer).toBe(0);
    }
    expect(world.population.count).toBe(0);
    expect(food(world)).toBe(4);
  });
});

describe('World population: leaving', () => {
  it('sends the highest ids away when a Hovel is demolished', () => {
    const world = new World(flatMap());
    place(world, ObjectKind.Keep, 2, 2);
    const hovel = place(world, ObjectKind.Hovel, 10, 10);
    ticks(world, 400);
    expect(world.population).toEqual({ count: 8, housing: 8, idle: 8 });
    world.apply({ type: 'demolish', objectId: hovel.id });
    expect(world.population).toEqual({ count: 4, housing: 4, idle: 4 });
    expect([...world.peasants()].map((p) => p.id)).toEqual([1, 2, 3, 4]);
  });

  it('frees the job of a working peasant who leaves', () => {
    const world = new World(flatMap(), new Economy(resources(100, 40, 5)));
    world.spawn(ObjectKind.Tree, 12, 2);
    const keep = place(world, ObjectKind.Keep, 2, 2);
    const hut = place(world, ObjectKind.WoodcutterHut, 10, 2);
    ticks(world, 60);
    expect([...world.peasants()][0]).toMatchObject({ state: 'toWork', workplaceId: hut.id });
    world.apply({ type: 'demolish', objectId: keep.id });
    expect(world.population.count).toBe(0);
    expect(world.productionState(hut.id)?.status).toBe('noWorker');
  });

  it('empties the camp when the only Keep is demolished, and nobody arrives after', () => {
    const world = new World(flatMap());
    const keep = place(world, ObjectKind.Keep, 2, 2);
    ticks(world, 200);
    expect(world.population.count).toBe(4);
    world.apply({ type: 'demolish', objectId: keep.id });
    expect(world.population).toEqual({ count: 0, housing: 0, idle: 0 });
    const foodLeft = food(world);
    ticks(world, 500);
    expect(world.population.count).toBe(0);
    expect(food(world)).toBe(foodLeft);
  });
});

/** A Population on an open 16 x 16 map with a Keep at (0, 0); `blocked` tiles (and the Keep) are not walkable. */
function walkingSetup(): { population: Population; blocked: Set<number>; peasant: PeasantView } {
  const map = flatMap();
  const blocked = new Set<number>();
  const keep: MapObject = { id: 1, kind: ObjectKind.Keep, tx: 0, ty: 0 };
  for (const tile of Footprint.of(keep.kind, keep.tx, keep.ty).tiles()) blocked.add(tile.ty * SIZE + tile.tx);
  const isWalkable = (tx: number, ty: number): boolean => map.inBounds(tx, ty) && !blocked.has(ty * SIZE + tx);
  const host: PopulationHost = {
    map,
    isWalkable,
    accessTiles: (id: number): TileCoord[] =>
      id !== keep.id ? [] : [...Footprint.of(keep.kind, 0, 0).edgeNeighbours()].filter((t) => isWalkable(t.tx, t.ty)),
    objectById: (id: number): MapObject | undefined => (id === keep.id ? keep : undefined),
    objects: (): Iterable<MapObject> => [keep],
  };
  // Food for exactly one arrival, so no other peasant appears during the walks.
  const population = new Population(host, new Economy(resources(0, 0, 5)));
  population.buildingAdded(keep);
  ticks(population, 50);
  const [peasant] = [...population.peasants()];
  expect(peasant).toMatchObject({ tx: 0, ty: 4 });
  return { population, blocked, peasant };
}

/** Ticks until the peasant stands on `goal` (at most 200 ticks); returns the ticks taken and every tile entered. */
function walk(population: Population, goal: TileCoord): { ticksTaken: number; entered: TileCoord[] } {
  const entered: TileCoord[] = [];
  for (let n = 1; n <= 200; n++) {
    const before = [...population.peasants()][0];
    const from = { tx: before.tx, ty: before.ty };
    population.tick();
    const p = [...population.peasants()][0];
    if (p.tx !== from.tx || p.ty !== from.ty) entered.push({ tx: p.tx, ty: p.ty });
    if (p.tx === goal.tx && p.ty === goal.ty) {
      expect(p).toMatchObject({ nextTx: goal.tx, nextTy: goal.ty, stepProgress: 0, stepTicks: 0 });
      return { ticksTaken: n, entered };
    }
  }
  throw new Error('walk did not end');
}

describe('Population walking', () => {
  it('takes 4 ticks per straight step, counting stepProgress up within a step', () => {
    const { population, peasant } = walkingSetup();
    expect(population.walkTo(peasant, [{ tx: 3, ty: 4 }])).toBe(true);
    population.tick();
    expect([...population.peasants()][0]).toMatchObject({
      tx: 0, ty: 4, nextTx: 1, nextTy: 4, stepProgress: 1, stepTicks: 4,
    });
    ticks(population, 2);
    expect([...population.peasants()][0]).toMatchObject({ tx: 0, stepProgress: 3 });
    population.tick();
    expect([...population.peasants()][0]).toMatchObject({ tx: 1, ty: 4, stepProgress: 0 });
    const { ticksTaken } = walk(population, { tx: 3, ty: 4 });
    expect(4 + ticksTaken).toBe(12);
    ticks(population, 10);
    expect([...population.peasants()][0]).toMatchObject({ tx: 3, ty: 4, nextTx: 3, nextTy: 4, stepTicks: 0 });
  });

  it('takes 6 ticks per diagonal step', () => {
    const { population, peasant } = walkingSetup();
    population.walkTo(peasant, [{ tx: 2, ty: 6 }]);
    population.tick();
    expect([...population.peasants()][0]).toMatchObject({ nextTx: 1, nextTy: 5, stepTicks: 6 });
    const { ticksTaken } = walk(population, { tx: 2, ty: 6 });
    expect(1 + ticksTaken).toBe(12);
  });

  it('re-routes when the next tile of its path is built over, and still arrives', () => {
    const { population, blocked, peasant } = walkingSetup();
    population.walkTo(peasant, [{ tx: 6, ty: 4 }]);
    population.tick(); // stepping onto (1, 4); (2, 4) is next
    blocked.add(4 * SIZE + 2);
    const { entered } = walk(population, { tx: 6, ty: 4 });
    expect(entered).not.toContainEqual({ tx: 2, ty: 4 });
    expect(entered.length).toBeGreaterThan(6); // the straight route enters 6 tiles
  });

  it('walks off a tile that became covered by a building', () => {
    const { population, blocked, peasant } = walkingSetup();
    blocked.add(4 * SIZE + 0);
    expect(population.walkTo(peasant, [{ tx: 3, ty: 4 }])).toBe(true);
    const { ticksTaken } = walk(population, { tx: 3, ty: 4 });
    expect(ticksTaken).toBe(12);
  });

  it('reports false and stays put when no goal is reachable', () => {
    const { population, peasant } = walkingSetup();
    expect(population.walkTo(peasant, [{ tx: 1, ty: 1 }])).toBe(false);
    population.tick();
    expect([...population.peasants()][0]).toMatchObject({ tx: 0, ty: 4, stepTicks: 0 });
  });
});
