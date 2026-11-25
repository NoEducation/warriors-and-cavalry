import { describe, expect, it } from 'vitest';
import { GameMap } from '../src/sim/GameMap';
import { MapGenerator } from '../src/sim/MapGenerator';
import { ObjectKind } from '../src/sim/ObjectKind';
import { Economy } from '../src/sim/Economy';
import { ResourceKind, resources } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';
import { worldChecksum } from '../src/sim/worldChecksum';

const generator = new MapGenerator();

function flatMap(): GameMap {
  const size = 8;
  const tiles = new Uint8Array(size * size).fill(TileType.Grass);
  return new GameMap(size, size, 1, new Float32Array((size + 1) * (size + 1)), tiles);
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
    // covering the arrival timer and the peasants (was 1606265378 before that).
    // Tree looks are render-only, so changing them must not change this value.
    expect(worldChecksum(generator.generate({ seed: 1, width: 512, height: 512 }))).toBe(3863915074);
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
    // Same objects, amounts and tick count; only the hut's progress differs (50 ticks against 0).
    const hutWorld = (): World => {
      const world = new World(flatMap());
      world.spawn(ObjectKind.Tree, 6, 6);
      return world;
    };
    const hut = { type: 'placeBuilding', kind: ObjectKind.WoodcutterHut, tx: 1, ty: 1 } as const;
    const early = hutWorld();
    early.apply(hut);
    for (let i = 0; i < 50; i++) early.tick();
    const late = hutWorld();
    for (let i = 0; i < 50; i++) late.tick();
    late.apply(hut);
    expect(early.productionState(2)?.progress).toBe(50);
    expect(late.productionState(2)?.progress).toBe(0);
    expect(worldChecksum(early)).not.toBe(worldChecksum(late));
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
