import { describe, expect, it } from 'vitest';
import { GameMap } from '../src/sim/GameMap';
import { MapGenerator } from '../src/sim/MapGenerator';
import type { MapObject } from '../src/sim/MapObject';
import { ObjectKind } from '../src/sim/ObjectKind';
import { Economy } from '../src/sim/Economy';
import type { PeasantView } from '../src/sim/PeasantView';
import { RESOURCE_KINDS, ResourceKind, resources } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';
import type { ObjectCommandResult } from '../src/sim/WorldCommand';
import { worldChecksum } from '../src/sim/worldChecksum';

const generator = new MapGenerator();

function flatMap(): GameMap {
  const size = 8;
  const tiles = new Uint8Array(size * size).fill(TileType.Grass);
  return new GameMap(size, size, 1, new Float32Array((size + 1) * (size + 1)), tiles);
}

/**
 * A flat 48 x 16 world with quarry ground under a Quarry at (4, 1), a Keep far east at (40, 10); with `stockpile`, a
 * Stockpile at (12, 3), which the worker reaches from the Quarry by walking straight east. A quarry, not a woodcutter,
 * so no tree is felled: a stump's new object id would make the two worlds of a test differ in more than one field.
 */
function carrierCamp(economy: Economy, stockpile: boolean): { world: World; keep: MapObject } {
  const tiles = new Uint8Array(48 * 16).fill(TileType.Grass);
  for (let ty = 1; ty <= 3; ty++) for (let tx = 4; tx <= 6; tx++) tiles[ty * 48 + tx] = TileType.Quarry;
  const world = new World(new GameMap(48, 16, 1, new Float32Array(49 * 17), tiles), economy);
  const keep = world.apply({ type: 'placeBuilding', kind: ObjectKind.Keep, tx: 40, ty: 10 });
  world.apply({ type: 'placeBuilding', kind: ObjectKind.Quarry, tx: 4, ty: 1 });
  if (stockpile) world.apply({ type: 'placeBuilding', kind: ObjectKind.Stockpile, tx: 12, ty: 3 });
  if (!keep.ok) throw new Error('placement failed');
  return { world, keep: keep.object };
}

/**
 * Both worlds of the rebuilt-Stockpile tests, `walked` ticks after the tick in which the carrier picked up its
 * batch; B rebuilds the Stockpile then.
 */
function rebuiltStockpileWorlds(walked: number): [World, World] {
  const rebuild = (world: World): void => {
    const old = [...world.objects()].find((o) => o.kind === ObjectKind.Stockpile)!;
    world.apply({ type: 'demolish', objectId: old.id });
    world.apply({ type: 'placeBuilding', kind: ObjectKind.Stockpile, tx: old.tx, ty: old.ty });
  };
  const run = (early: boolean): World => {
    const { world } = carrierCamp(new Economy(resources(100, 40, 5)), true);
    if (early) rebuild(world);
    tickWhile(world, () => peasantOf(world)?.state !== 'toStore');
    for (let i = 0; i < walked; i++) world.tick();
    if (!early) rebuild(world);
    return world;
  };
  const a = run(true);
  const b = run(false);
  expect(a.tickCount).toBe(b.tickCount);
  return [a, b];
}

/** Ticks `world` (and `also`, in step) while `going` holds; at most 2000 ticks. */
function tickWhile(world: World, going: () => boolean, also?: World): void {
  for (let n = 0; going(); n++) {
    if (n >= 2000) throw new Error('condition not reached');
    world.tick();
    also?.tick();
  }
}

function demolish(world: World, placed: ObjectCommandResult): void {
  if (!placed.ok) throw new Error('placement failed');
  world.apply({ type: 'demolish', objectId: placed.object.id });
}

const peasantOf = (world: World): PeasantView | undefined => [...world.peasants()][0];

/** Every field of a peasant's view, its path cut to the tiles still ahead. */
function remaining(p: PeasantView): Record<keyof PeasantView, unknown> {
  const { id, state, tx, ty, nextTx, nextTy, stepProgress, stepTicks, load, workplaceId, targetId, treeId, waitTicks } = p;
  const view = { id, state, tx, ty, nextTx, nextTy, stepProgress, stepTicks, load, workplaceId, targetId, treeId, waitTicks };
  return { ...view, path: p.path.slice(p.pathIndex), pathIndex: p.pathIndex, stand: p.stand };
}

/**
 * Asserts that `a` and `b` have the same tick count, economy, objects, arrival timer and one peasant each, alike in
 * every field (its path compared by the tiles still ahead) except `field`.
 */
function expectOnlyPeasantFieldDiffers(a: World, b: World, field: keyof PeasantView): void {
  expect(a.tickCount).toBe(b.tickCount);
  expect(a.arrivalTimer).toBe(b.arrivalTimer);
  for (const kind of RESOURCE_KINDS) {
    expect(a.economy.amount(kind)).toBe(b.economy.amount(kind));
    expect(a.economy.capacity(kind)).toBe(b.economy.capacity(kind));
  }
  expect([...a.objects()]).toEqual([...b.objects()]);
  const [pa, pb] = [peasantOf(a)!, peasantOf(b)!];
  expect([a.population.count, b.population.count]).toEqual([1, 1]);
  expect(remaining(pa)[field], `${field} differs`).not.toEqual(remaining(pb)[field]);
  expect({ ...remaining(pa), [field]: null }).toEqual({ ...remaining(pb), [field]: null });
}

describe('worldChecksum', () => {
  it('is the same for worlds generated from the same params', () => {
    const a = generator.generate({ seed: 42, width: 64, height: 64 });
    const b = generator.generate({ seed: 42, width: 64, height: 64 });
    expect(worldChecksum(a)).toBe(worldChecksum(b));
  });

  it('keeps the seed 1 world of 512 x 512 tiles unchanged', () => {
    // Re-recorded when the checksum started covering the tick count (was 3842414936 before that), and again when it
    // started covering resource amounts and capacities (was 541835208 before that), and again when it started
    // covering the arrival timer and the peasants (was 1606265378 before that), and again when map generation gained
    // ridged mountains (was 3863915074 before that), and again when it gained quarry ground (was 3247290596 before
    // that).
    // Tree looks are render-only, so changing them must not change this value.
    expect(worldChecksum(generator.generate({ seed: 1, width: 512, height: 512 }))).toBe(1557280754);
  });

  it('differs for different seeds', () => {
    const a = generator.generate({ seed: 1, width: 128, height: 128 });
    const b = generator.generate({ seed: 2, width: 128, height: 128 });
    expect(worldChecksum(a)).not.toBe(worldChecksum(b));
  });

  it('changes after a tick', () => {
    const world = generator.generate({ seed: 3, width: 64, height: 64 });
    const before = worldChecksum(world);
    world.tick();
    expect(worldChecksum(world)).not.toBe(before);
  });

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

  it('covers resource amounts, not only objects', () => {
    // Same map, no objects and no ticks in either world; only B's wood differs, because B placed a Hovel
    // and demolished it again (net -8 wood, since the refund is half).
    const a = new World(flatMap());
    const b = new World(flatMap());
    const temp = b.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 1, ty: 1 });
    if (!temp.ok) throw new Error('placement failed');
    b.apply({ type: 'demolish', objectId: temp.object.id });
    expect(b.economy.amount(ResourceKind.Wood)).toBe(92);
    expect(worldChecksum(a)).not.toBe(worldChecksum(b));
  });

  it('covers production progress', () => {
    // Same objects, amounts, peasants and tick count; only the hut's progress differs, because B's wood was at
    // capacity (so its hut paused) for 10 ticks and was then spent back down.
    const hutWorld = (economy: Economy): World => {
      const world = new World(flatMap(), economy);
      world.spawn(ObjectKind.Tree, 7, 7);
      world.apply({ type: 'placeBuilding', kind: ObjectKind.Keep, tx: 0, ty: 0 });
      world.apply({ type: 'placeBuilding', kind: ObjectKind.WoodcutterHut, tx: 5, ty: 0 });
      while (world.productionProgress(3) === 0) world.tick(); // until its worker has started
      return world;
    };
    const a = hutWorld(new Economy(resources(100, 40, 5)));
    const poorB = new Economy(resources(100, 40, 5));
    const b = hutWorld(poorB);
    poorB.add(ResourceKind.Wood, 70);
    for (let i = 0; i < 10; i++) {
      a.tick();
      b.tick();
    }
    poorB.spend(resources(70, 0, 0));
    expect([a.productionProgress(3), b.productionProgress(3)]).toEqual([11, 1]);
    expect(a.economy.amount(ResourceKind.Wood)).toBe(b.economy.amount(ResourceKind.Wood));
    expect(worldChecksum(a)).not.toBe(worldChecksum(b));
  });

  it('covers the ticks a building is skipped by job assignment', () => {
    // A hut cut off by water; in A it stands before the only peasant arrives (tick 50), in B it is placed 5 ticks
    // later. Each peasant gives the hut up at once, so only the remaining skip ticks differ.
    const size = 16;
    const tiles = new Uint8Array(size * size).fill(TileType.Grass);
    for (let i = 9; i < size; i++) tiles[9 * size + i] = tiles[i * size + 9] = TileType.Water;
    const map = new GameMap(size, size, 1, new Float32Array((size + 1) * (size + 1)), tiles);
    const hut = { type: 'placeBuilding', kind: ObjectKind.WoodcutterHut, tx: 11, ty: 11 } as const;
    const run = (hutTick: number): World => {
      const world = new World(map, new Economy(resources(100, 40, 5)));
      world.spawn(ObjectKind.Tree, 13, 13);
      world.apply({ type: 'placeBuilding', kind: ObjectKind.Keep, tx: 0, ty: 0 });
      for (let tick = 0; tick < 100; tick++) {
        if (tick === hutTick) world.apply(hut);
        world.tick();
      }
      return world;
    };
    const a = run(40);
    const b = run(55);
    expect([a.jobSkipTicks(3), b.jobSkipTicks(3)]).toEqual([150, 156]);
    expect([...a.peasants()]).toEqual([...b.peasants()]);
    expect(worldChecksum(a)).not.toBe(worldChecksum(b));
  });

  it('is equal for worlds with the same peasants after the same ticks', () => {
    const run = (): World => {
      const world = new World(flatMap());
      world.apply({ type: 'placeBuilding', kind: ObjectKind.Keep, tx: 1, ty: 1 });
      for (let i = 0; i < 300; i++) world.tick();
      return world;
    };
    const a = run();
    expect(a.population.count).toBe(4);
    expect(worldChecksum(a)).toBe(worldChecksum(run()));
  });

  it('covers the arrival timer and the peasants', () => {
    // Keep placed one tick later in B. After 120 ticks both have 2 peasants and the same food; only the timer differs.
    const keep = { type: 'placeBuilding', kind: ObjectKind.Keep, tx: 1, ty: 1 } as const;
    const a = new World(flatMap());
    a.apply(keep);
    for (let i = 0; i < 120; i++) a.tick();
    const b = new World(flatMap());
    b.tick();
    b.apply(keep);
    for (let i = 0; i < 119; i++) b.tick();
    expect([a.arrivalTimer, b.arrivalTimer]).toEqual([20, 19]);
    expect(a.population.count).toBe(b.population.count);
    expect(worldChecksum(a)).not.toBe(worldChecksum(b));
  });

  it('covers the ticks a carrier still waits before searching again', () => {
    // No storage place after the Keep is demolished, so the carrier waits. B's quarry paused 10 ticks (stone at
    // capacity, spent back down after), so B's carrier started waiting 10 ticks later.
    const run = (pause: boolean): World => {
      const economy = new Economy(resources(100, 40, 5));
      const { world, keep } = carrierCamp(economy, false);
      world.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 30, ty: 2 }); // houses the peasant
      tickWhile(world, () => peasantOf(world)?.state !== 'working');
      world.apply({ type: 'demolish', objectId: keep.id });
      const topUp = economy.capacity(ResourceKind.Stone) - economy.amount(ResourceKind.Stone);
      if (pause) economy.add(ResourceKind.Stone, topUp);
      for (let i = 0; i < 10; i++) world.tick();
      if (pause) economy.spend(resources(0, topUp, 0));
      return world;
    };
    const a = run(false);
    const b = run(true);
    tickWhile(b, () => peasantOf(b)!.state !== 'toStore', a);
    for (let i = 0; i < 5; i++) [a, b].forEach((world) => world.tick());
    expectOnlyPeasantFieldDiffers(a, b, 'waitTicks');
    expect([peasantOf(a)!.waitTicks, peasantOf(b)!.waitTicks]).toEqual([36, 46]); // 50 + id 1 % 8, less 15 or 5
    expect(worldChecksum(a)).not.toBe(worldChecksum(b));
  });

  it('covers the storage place a carrier delivers to', () => {
    // Both worlds build the Stockpile, demolish it and build it again on the same spot; A before the batch is picked
    // up, B right after, so B's carrier still targets the old Stockpile until its next tick.
    const [a, b] = rebuiltStockpileWorlds(0);
    expectOnlyPeasantFieldDiffers(a, b, 'targetId');
    expect(worldChecksum(a)).not.toBe(worldChecksum(b));
  });

  it('covers how far along its path a walker is', () => {
    // As above, but B rebuilds one tick into the first step; on the next tick B's carrier searches again mid-step
    // (its target is gone), so it walks the same remaining tiles from the start of a new path.
    const [a, b] = rebuiltStockpileWorlds(1);
    a.tick();
    b.tick();
    expectOnlyPeasantFieldDiffers(a, b, 'pathIndex');
    expect(worldChecksum(a)).not.toBe(worldChecksum(b));
  });

  it('covers the tiles left on a walker\'s path', () => {
    // A Hovel stands in the carrier's way while B's carrier searches; A builds and demolishes it before that.
    const hovel = { type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 8, ty: 3 } as const;
    const run = (late: boolean): World => {
      const economy = new Economy(resources(100, 40, 5));
      const { world } = carrierCamp(economy, true);
      economy.add(ResourceKind.Wood, 20); // the Quarry left too little for the Hovel
      if (!late) demolish(world, world.apply(hovel));
      tickWhile(world, () => peasantOf(world)?.state !== 'working');
      const temp = late ? world.apply(hovel) : null;
      tickWhile(world, () => peasantOf(world)!.state !== 'toStore');
      if (temp) demolish(world, temp);
      return world;
    };
    const a = run(false);
    const b = run(true);
    expect(a.tickCount).toBe(b.tickCount);
    expectOnlyPeasantFieldDiffers(a, b, 'path');
    expect(worldChecksum(a)).not.toBe(worldChecksum(b));
  });

  it('covers the peasants, not only the food they cost', () => {
    // Same objects, food, tick count and timer; A paid 5 of its 50 food for a peasant, B started too poor and is
    // topped up to the same 45 afterwards.
    const keep = { type: 'placeBuilding', kind: ObjectKind.Keep, tx: 1, ty: 1 } as const;
    const a = new World(flatMap());
    a.apply(keep);
    for (let i = 0; i < 50; i++) a.tick();
    const poor = new Economy(resources(100, 40, 4));
    const b = new World(flatMap(), poor);
    b.apply(keep);
    for (let i = 0; i < 50; i++) b.tick();
    poor.add(ResourceKind.Food, 41);
    expect([a.population.count, b.population.count]).toEqual([1, 0]);
    expect([a.economy.amount(ResourceKind.Food), b.economy.amount(ResourceKind.Food)]).toEqual([45, 45]);
    expect([a.arrivalTimer, b.arrivalTimer]).toEqual([0, 0]);
    expect(worldChecksum(a)).not.toBe(worldChecksum(b));
  });
});
