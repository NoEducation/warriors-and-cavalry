import { describe, expect, it } from 'vitest';
import { Economy } from '../src/sim/Economy';
import { GameMap } from '../src/sim/GameMap';
import { ObjectKind } from '../src/sim/ObjectKind';
import { PathFinder } from '../src/sim/PathFinder';
import { Peasant } from '../src/sim/Peasant';
import { PeasantWalker } from '../src/sim/PeasantWalker';
import { ResourceKind, resources } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import { WalkClass, WalkMode } from '../src/sim/walkRules';
import type { PeasantView } from '../src/sim/PeasantView';
import { World } from '../src/sim/World';

function flatWorld(size = 32, economy = new Economy()): World {
  const tiles = new Uint8Array(size * size).fill(TileType.Grass);
  return new World(new GameMap(size, size, 1, new Float32Array((size + 1) * (size + 1)), tiles), economy);
}

function place(world: World, kind: ObjectKind, tx: number, ty: number): void {
  const result = world.apply({ type: 'placeBuilding', kind, tx, ty });
  if (!result.ok) throw new Error(`placement failed: ${result.reason}`);
}

describe('the wall walk', () => {
  it('tells walls and towers as tops, stairs as stairs, gates as ground', () => {
    const world = flatWorld();
    world.spawn(ObjectKind.Wall, 5, 5);
    world.spawn(ObjectKind.Tower, 6, 5);
    world.spawn(ObjectKind.Gate, 8, 5);
    world.spawn(ObjectKind.Stairs, 5, 6);
    expect(world.walkClass(5, 5)).toBe(WalkClass.Top);
    expect(world.walkClass(7, 6)).toBe(WalkClass.Top);
    expect(world.walkClass(8, 5)).toBe(WalkClass.Ground);
    expect(world.walkClass(5, 6)).toBe(WalkClass.Stairs);
    expect(world.isWalkable(5, 6)).toBe(true);
    expect(world.isWalkable(5, 5)).toBe(false);
  });

  it('is climbed by stairs and followed along a diagonal wall run, only when climbing', () => {
    const world = flatWorld();
    for (const [tx, ty] of [[5, 5], [6, 6], [7, 7]]) world.spawn(ObjectKind.Wall, tx, ty);
    world.spawn(ObjectKind.Stairs, 4, 5);
    const finder = new PathFinder(32, 32);
    const walkClass = world.walkClass.bind(world);
    expect(finder.findWith({ tx: 4, ty: 5 }, [{ tx: 7, ty: 7 }], walkClass, WalkMode.Climb)).toEqual([
      { tx: 5, ty: 5 },
      { tx: 6, ty: 6 },
      { tx: 7, ty: 7 },
    ]);
    expect(finder.findWith({ tx: 4, ty: 5 }, [{ tx: 7, ty: 7 }], walkClass, WalkMode.Ground)).toBeNull();
    expect(finder.findWith({ tx: 3, ty: 5 }, [{ tx: 7, ty: 7 }], walkClass, WalkMode.Climb)).not.toBeNull();
  });

  it('is left down a stair on a ground walk', () => {
    const world = flatWorld();
    for (const tx of [5, 6, 7]) world.spawn(ObjectKind.Wall, tx, 5);
    world.spawn(ObjectKind.Stairs, 8, 5);
    const walker = new PeasantWalker(32, 32, world.walkClass.bind(world));
    const p = new Peasant(1, 5, 5);
    expect(walker.walkTo(p, [{ tx: 10, ty: 5 }])).toBe(true);
    expect(p.walkMode).toBe(WalkMode.Ground);
    expect(p.path).toContainEqual({ tx: 8, ty: 5 });
    for (let n = 0; n < 200 && (p.tx !== 10 || p.ty !== 5); n++) walker.tick(p);
    expect([p.tx, p.ty]).toEqual([10, 5]);
  });

  it('is climbed down from on the spot when no stair is left', () => {
    const world = flatWorld();
    world.spawn(ObjectKind.Wall, 5, 5);
    const walker = new PeasantWalker(32, 32, world.walkClass.bind(world));
    const p = new Peasant(1, 5, 5);
    expect(walker.walkTo(p, [{ tx: 10, ty: 5 }])).toBe(true);
    expect(p.walkMode).toBe(WalkMode.Down);
    for (let n = 0; n < 200 && (p.tx !== 10 || p.ty !== 5); n++) walker.tick(p);
    expect([p.tx, p.ty]).toEqual([10, 5]);
  });

  it('is never used by a carrier: with stairs on both sides of a wall, its trips still go through the gate', () => {
    const world = flatWorld(32, new Economy(resources(100, 40, 5)));
    for (let ty = 0; ty < 32; ty++) world.spawn(ty === 28 ? ObjectKind.Gate : ObjectKind.Wall, 16, ty);
    world.spawn(ObjectKind.Stairs, 15, 10);
    world.spawn(ObjectKind.Stairs, 17, 10);
    world.spawn(ObjectKind.Tree, 26, 9);
    place(world, ObjectKind.Keep, 2, 2);
    place(world, ObjectKind.Stockpile, 8, 8);
    place(world, ObjectKind.WoodcutterHut, 22, 8);
    const wood = world.economy.amount(ResourceKind.Wood);
    let throughGate = false;
    for (let n = 0; n < 4000 && world.economy.amount(ResourceKind.Wood) === wood; n++) {
      world.tick();
      for (const p of world.peasants()) {
        expect(world.walkClass(p.tx, p.ty)).not.toBe(WalkClass.Top);
        throughGate ||= p.tx === 16 && p.ty === 28;
      }
    }
    expect(world.economy.amount(ResourceKind.Wood)).toBe(wood + 2);
    expect(throughGate).toBe(true);
  });
});

/** Ticks `world` until `done` holds (at most `max` ticks); throws when it never does. */
function tickUntil(world: World, done: () => boolean, max = 3000): void {
  for (let n = 0; n < max; n++) {
    world.tick();
    if (done()) return;
  }
  throw new Error('condition not reached');
}

/** A flat camp with a Keep at (2, 2), food for one arrival and a wall along x = 12 from y = 4 to 10; with `stairs`, a stair at (11, 7). */
function lookoutCamp(stairs: boolean): World {
  const world = flatWorld(32, new Economy(resources(200, 80, 5)));
  for (let ty = 4; ty <= 10; ty++) world.spawn(ObjectKind.Wall, 12, ty);
  if (stairs) world.spawn(ObjectKind.Stairs, 11, 7);
  place(world, ObjectKind.Keep, 2, 2);
  return world;
}

const only = (world: World): PeasantView => [...world.peasants()][0];
/** True once the one peasant has arrived, has a stand and stands on it. */
const settled = (world: World): boolean => {
  const p = [...world.peasants()][0];
  return p !== undefined && p.stand !== null && p.tx === p.stand.tx && p.ty === p.stand.ty && p.stepTicks === 0;
};

describe('lookouts', () => {
  it('an idle peasant climbs the stairs and keeps watch on the wall', () => {
    const world = lookoutCamp(true);
    tickUntil(world, () => settled(world));
    expect(world.walkClass(only(world).tx, only(world).ty)).toBe(WalkClass.Top);
  });

  it('without stairs an idle peasant waits on the ground', () => {
    const world = lookoutCamp(false);
    tickUntil(world, () => settled(world));
    expect(world.walkClass(only(world).tx, only(world).ty)).toBe(WalkClass.Ground);
  });

  it('climbs once stairs are built after it settled', () => {
    const world = lookoutCamp(false);
    tickUntil(world, () => settled(world));
    place(world, ObjectKind.Stairs, 11, 7);
    tickUntil(world, () => settled(world) && world.walkClass(only(world).tx, only(world).ty) === WalkClass.Top);
  });

  it('comes down the stairs and reaches work when given a job', () => {
    const world = lookoutCamp(true);
    tickUntil(world, () => settled(world));
    place(world, ObjectKind.WheatFarm, 20, 20);
    tickUntil(world, () => only(world).state === 'working');
  });

  it('climbs down on the spot when its only stair is demolished, and still reaches work', () => {
    const world = lookoutCamp(true);
    tickUntil(world, () => settled(world));
    const stair = world.objectAt(11, 7)!;
    expect(world.apply({ type: 'demolish', objectId: stair.id }).ok).toBe(true);
    place(world, ObjectKind.WheatFarm, 20, 20);
    tickUntil(world, () => only(world).state === 'working');
  });

  it('steps down to the ground when the wall under it is demolished', () => {
    const world = lookoutCamp(true);
    tickUntil(world, () => settled(world));
    const wall = world.objectAt(only(world).tx, only(world).ty)!;
    expect(world.apply({ type: 'demolish', objectId: wall.id }).ok).toBe(true);
    tickUntil(world, () => settled(world));
    expect(world.walkClass(only(world).tx, only(world).ty)).not.toBe(WalkClass.Blocked);
  });
});
