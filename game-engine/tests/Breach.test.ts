import { describe, expect, it, vi } from 'vitest';
import { PathFinder } from '../src/sim/PathFinder';
import { ObjectKind } from '../src/sim/ObjectKind';
import { Side, UnitKind } from '../src/sim/UnitKind';
import type { World } from '../src/sim/World';
import { combatWorld, place, run, runUntil } from './combatWorld';

/** A closed square of wall from (9, 9) to (18, 18) with a gate at (13, 9), and a Keep inside at (12, 12). */
function walledKeep(world: World): { keepId: number; gateId: number } {
  const corners: [number, number, number, number][] = [[9, 9, 18, 9], [18, 9, 18, 18], [18, 18, 9, 18], [9, 18, 9, 9]];
  for (const [fromTx, fromTy, toTx, toTy] of corners) world.apply({ type: 'placeWallLine', fromTx, fromTy, toTx, toTy });
  const piece = world.objectAt(13, 9)!;
  world.apply({ type: 'demolish', objectId: piece.id });
  const gate = world.spawn(ObjectKind.Gate, 13, 9); // spawned: the ring's stone uses up the store
  const keep = world.spawn(ObjectKind.Keep, 12, 12);
  return { keepId: keep.id, gateId: gate.id };
}

describe('gates and breaching', () => {
  it('keeps raiders off the gate; they break the piece in their way, walk in and strike the Keep', () => {
    const world = combatWorld(32, () => false, 1);
    const { keepId, gateId } = walledKeep(world);
    const raiders = [12, 13, 14].map((tx) => world.spawnUnit(Side.Raider, UnitKind.Spearman, tx, 3).id);
    let onGate = false;
    const breached = new Set<number>();
    runUntil(world, () => {
      for (const id of raiders) {
        const r = world.unitById(id)!;
        if (world.objectById(gateId) && r.tx === 13 && r.ty === 9) onGate = true;
        if (r.target?.type === 'building' && r.target.id !== keepId) breached.add(r.target.id);
      }
      return (world.buildingHitPoints(keepId)?.current ?? 0) < 600;
    }, 3000);
    expect(onGate).toBe(false);
    expect(breached.size).toBe(1);
    const [piece] = breached;
    expect(world.objectById(piece)).toBeUndefined();
  });

  it('still breaks in when two or more workers stand in sight behind the wall', () => {
    const world = combatWorld(32, () => false, 1);
    const { keepId } = walledKeep(world);
    world.spawn(ObjectKind.WoodcutterHut, 10, 10);
    world.spawn(ObjectKind.WoodcutterHut, 16, 10);
    runUntil(world, () => world.population.count === 2 && [...world.peasants()].every((p) => p.state === 'working'), 300);
    for (const tx of [12, 13, 14]) world.spawnUnit(Side.Raider, UnitKind.Spearman, tx, 4);
    runUntil(world, () => (world.buildingHitPoints(keepId)?.current ?? 0) < 600 || world.population.count < 2, 3000);
  });

  it('searches the way to a walled Keep once for a wave standing on one tile', () => {
    const world = combatWorld(64, () => false, 1);
    const corners: [number, number, number, number][] = [[9, 9, 18, 9], [18, 9, 18, 18], [18, 18, 9, 18], [9, 18, 9, 9]];
    for (const [fromTx, fromTy, toTx, toTy] of corners) world.apply({ type: 'placeWallLine', fromTx, fromTy, toTx, toTy });
    world.spawn(ObjectKind.Keep, 12, 12);
    for (let i = 0; i < 6; i++) world.spawnUnit(Side.Raider, UnitKind.Spearman, 40, 40);
    const searches = vi.spyOn(PathFinder.prototype, 'findWith');
    world.tick();
    // One failed search to the Keep, one breach search, then each raider's short walk to the hole.
    expect(searches.mock.calls.length).toBeLessThanOrEqual(8);
    searches.mockRestore();
  });

  it('has raiders cut off by water wait between searches instead of searching every tick', () => {
    const island = (tx: number, ty: number): boolean => tx >= 8 && tx <= 20 && ty >= 8 && ty <= 20 && !(tx >= 10 && tx <= 18 && ty >= 10 && ty <= 18);
    const world = combatWorld(32, island, 1);
    place(world, ObjectKind.Keep, 12, 12);
    const raider = world.spawnUnit(Side.Raider, UnitKind.Spearman, 3, 3).id;
    run(world, 5);
    let waiting = 0;
    for (let i = 0; i < 200; i++) {
      world.tick();
      if (world.unitById(raider)!.waitTicks > 0) waiting++;
    }
    expect(waiting).toBeGreaterThanOrEqual(190);
  });
});
