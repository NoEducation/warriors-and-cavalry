import { describe, expect, it } from 'vitest';
import { Economy } from '../src/sim/Economy';
import { GameMap } from '../src/sim/GameMap';
import type { MapObject } from '../src/sim/MapObject';
import { OBJECT_KINDS, ObjectKind } from '../src/sim/ObjectKind';
import type { PeasantView } from '../src/sim/PeasantView';
import { POPULATION_CONFIG } from '../src/sim/populationConfig';
import { ResourceKind, resources } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';
import type { ObjectCommandResult } from '../src/sim/WorldCommand';
import { worldChecksum } from '../src/sim/worldChecksum';

const SIZE = 16;

function flatMap(size = SIZE): GameMap {
  const tiles = new Uint8Array(size * size).fill(TileType.Grass);
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
      retrySpread: 8,
      unreachableSkipTicks: 200,
      straightStepTicks: 4,
      diagonalStepTicks: 6,
      stumpTicks: 600,
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

  it('sends idle peasants away first, then workers, each by highest id; a leaving carrier loses its load', () => {
    // Six huts for eight peasants: 1..6 work, 7 and 8 stay idle. No wood at the start, so no hut is at capacity.
    const world = new World(flatMap(32), new Economy(resources(0, 0, 40)));
    world.spawn(ObjectKind.Keep, 2, 2);
    const hovel = world.spawn(ObjectKind.Hovel, 2, 10);
    for (const tx of [6, 10, 14, 18, 22, 26]) world.spawn(ObjectKind.Tree, tx, 24); // one per woodcutter
    const huts = [4, 8, 12, 16, 20, 24].map((tx) => world.spawn(ObjectKind.WoodcutterHut, tx, 20));
    const byId = (id: number): PeasantView | undefined => [...world.peasants()].find((p) => p.id === id);
    for (let n = 0; !(world.population.count === 8 && byId(6)?.load); n++) {
      if (n > 3000) throw new Error('peasant 6 never carried');
      world.tick();
    }
    expect([...world.peasants()].map((p) => p.workplaceId !== null)).toEqual([...Array(6).fill(true), false, false]);
    expect(world.population).toEqual({ count: 8, housing: 8, idle: 2 });
    expect(byId(6)?.workplaceId).toBe(huts[5].id);
    const wood = world.economy.amount(ResourceKind.Wood);
    world.apply({ type: 'demolish', objectId: hovel.id }); // refunds 7 wood; 4 peasants must leave
    expect([...world.peasants()].map((p) => p.id)).toEqual([1, 2, 3, 4]);
    expect(world.population).toEqual({ count: 4, housing: 4, idle: 0 });
    expect(world.economy.amount(ResourceKind.Wood)).toBe(wood + 7); // the refund only: the load is gone
    for (const hut of huts.slice(4)) expect(world.productionState(hut.id)?.status).toBe('noWorker');
    world.tick();
    expect(world.economy.amount(ResourceKind.Wood)).toBe(wood + 7);
    for (const hut of huts.slice(4)) expect(world.productionState(hut.id)?.status).toBe('noWorker');
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


/** Where each peasant stands, as "tx,ty". */
const tilesOf = (world: World): string[] => [...world.peasants()].map((p) => `${p.tx},${p.ty}`);

/** A Keep at (2, 2) (its first ring: bottom row 6, right column 6, ...), a Hovel and six idle peasants, settled. */
function idleCamp(): World {
  const world = new World(flatMap(), new Economy(resources(100, 40, 30)));
  place(world, ObjectKind.Keep, 2, 2);
  place(world, ObjectKind.Hovel, 10, 10);
  ticks(world, 6 * 50 + 40);
  return world;
}

describe('World population: idle peasants', () => {
  it('stands idle peasants on distinct tiles around the Keep, ring by ring in a fixed order', () => {
    const world = idleCamp();
    const peasants = [...world.peasants()];
    expect(peasants).toHaveLength(6);
    expect(peasants.every((p) => p.state === 'idle' && p.stepTicks === 0)).toBe(true);
    // Bottom edge left to right, then the right edge from the top.
    expect(tilesOf(world).sort()).toEqual(['2,6', '3,6', '4,6', '5,6', '6,2', '6,3'].sort());
    ticks(world, 100);
    expect(tilesOf(world).sort()).toEqual(['2,6', '3,6', '4,6', '5,6', '6,2', '6,3'].sort());
  });

  it('moves idle peasants off tiles a building is placed on, onto free tiles', () => {
    const run = (): World => {
      const world = idleCamp();
      place(world, ObjectKind.Hovel, 3, 6); // covers (3, 6) and (4, 6), where two peasants stand
      ticks(world, 20);
      return world;
    };
    const world = run();
    const peasants = [...world.peasants()];
    expect(peasants.every((p) => p.stepTicks === 0 && world.isWalkable(p.tx, p.ty))).toBe(true);
    expect(new Set(tilesOf(world)).size).toBe(6);
    expect(worldChecksum(world)).toBe(worldChecksum(run()));
  });

  it('never stands an idle peasant on a Gate tile', () => {
    const world = new World(flatMap(), new Economy(resources(100, 46, 30)));
    place(world, ObjectKind.Keep, 2, 2);
    place(world, ObjectKind.Gate, 2, 6); // the first tile of the first ring
    place(world, ObjectKind.Hovel, 10, 10);
    ticks(world, 6 * 50 + 40);
    const peasants = [...world.peasants()];
    expect(peasants.every((p) => p.state === 'idle' && p.stepTicks === 0)).toBe(true);
    expect(tilesOf(world).sort()).toEqual(['3,6', '4,6', '5,6', '6,2', '6,3', '6,4'].sort());
  });
});
