import { describe, expect, it } from 'vitest';
import { ObjectKind } from '../src/sim/ObjectKind';
import { Side, UnitKind } from '../src/sim/UnitKind';
import type { UnitView } from '../src/sim/UnitView';
import { WalkClass } from '../src/sim/walkRules';
import type { World } from '../src/sim/World';
import { combatWorld, place, run, runUntil } from './combatWorld';

const unit = (world: World, id: number): UnitView | undefined => world.unitById(id);
const settled = (u: UnitView | undefined): boolean => !!u && u.stepTicks === 0 && u.pathIndex >= u.path.length;

/** A wall from (10, 4) to (10, 14) with stairs on its west side at (9, 9). */
function wallWithStairs(world: World): void {
  const line = world.apply({ type: 'placeWallLine', fromTx: 10, fromTy: 4, toTx: 10, toTy: 14 });
  if (!line.ok) throw new Error('wall failed');
  place(world, ObjectKind.Stairs, 9, 9);
}

describe('orders', () => {
  it('walks a group to distinct tiles round the move target, then stands idle', () => {
    const world = combatWorld();
    const ids = [2, 3, 4].map((ty) => world.spawnUnit(Side.Player, UnitKind.Spearman, 2, ty).id);
    expect(world.apply({ type: 'orderMove', unitIds: ids, tx: 20, ty: 20 })).toEqual({ ok: true, ordered: 3 });
    runUntil(world, () => ids.every((id) => unit(world, id)?.order === 'idle' && settled(unit(world, id))), 400);
    const tiles = ids.map((id) => [unit(world, id)!.tx, unit(world, id)!.ty]);
    expect(tiles[0]).toEqual([20, 20]);
    expect(new Set(tiles.map(([x, y]) => `${x},${y}`)).size).toBe(3);
    for (const [x, y] of tiles) expect(Math.max(Math.abs(x - 20), Math.abs(y - 20))).toBeLessThanOrEqual(1);
  });

  it('sends an Archer up the stairs onto a wall top, where it stays', () => {
    const world = combatWorld();
    wallWithStairs(world);
    const archer = world.spawnUnit(Side.Player, UnitKind.Archer, 2, 9).id;
    world.apply({ type: 'orderMove', unitIds: [archer], tx: 10, ty: 6 });
    runUntil(world, () => unit(world, archer)?.order === 'idle', 400);
    expect([unit(world, archer)!.tx, unit(world, archer)!.ty]).toEqual([10, 6]);
    expect(world.walkClass(10, 6)).toBe(WalkClass.Top);
    run(world, 200);
    expect([unit(world, archer)!.tx, unit(world, archer)!.ty]).toEqual([10, 6]);
  });

  it('has a Spearman ordered to attack walk up to a raider and kill it in 6 strikes, then stand idle', () => {
    const world = combatWorld();
    const spearman = world.spawnUnit(Side.Player, UnitKind.Spearman, 5, 5).id;
    const raider = world.spawnUnit(Side.Raider, UnitKind.Spearman, 12, 5).id;
    expect(world.apply({ type: 'orderAttack', unitIds: [spearman], targetUnitId: raider })).toEqual({ ok: true, ordered: 1 });
    let strikes = 0;
    let last = -1;
    runUntil(world, () => {
      const s = unit(world, spearman)!;
      if (s.lastStrikeTick !== last) [strikes, last] = [strikes + 1, s.lastStrikeTick];
      return unit(world, raider) === undefined;
    }, 600);
    expect(strikes).toBe(6);
    run(world, 1); // the dead raider is removed at the end of its tick; the next tick the Spearman stands down
    expect(unit(world, spearman)).toMatchObject({ order: 'idle', target: null });
  });

  it('has an idle Archer on a wall shoot a raider 8 tiles off without leaving the wall; a raider Spearman cannot reach it', () => {
    const world = combatWorld();
    wallWithStairs(world);
    const archer = world.spawnUnit(Side.Player, UnitKind.Archer, 10, 8).id;
    const raider = world.spawnUnit(Side.Raider, UnitKind.Spearman, 18, 8).id;
    runUntil(world, () => unit(world, raider) === undefined, 600);
    expect(unit(world, archer)).toMatchObject({ tx: 10, ty: 8, hitPoints: 35 });
  });

  it('skips duplicate, dead and raider ids, and fails when no living player unit is left', () => {
    const world = combatWorld();
    const a = world.spawnUnit(Side.Player, UnitKind.Spearman, 2, 2).id;
    const r = world.spawnUnit(Side.Raider, UnitKind.Spearman, 30, 30).id;
    expect(world.apply({ type: 'orderMove', unitIds: [a, a, r, 99], tx: 8, ty: 8 })).toEqual({ ok: true, ordered: 1 });
    expect(unit(world, r)).toMatchObject({ order: 'idle', moveTx: 30 });
    expect(world.apply({ type: 'orderMove', unitIds: [r, 99], tx: 8, ty: 8 })).toEqual({ ok: false, reason: 'NoUnits' });
    expect(world.apply({ type: 'orderAttack', unitIds: [a], targetUnitId: a })).toEqual({ ok: false, reason: 'UnknownUnit' });
    expect(world.apply({ type: 'orderMove', unitIds: [a], tx: 1.5, ty: 8 })).toEqual({ ok: false, reason: 'UnknownCommand' });
    expect(world.apply({ type: 'orderMove', unitIds: 'x' as unknown as number[], tx: 1, ty: 8 })).toEqual({
      ok: false,
      reason: 'UnknownCommand',
    });
    expect(world.apply({ type: 'orderMove', unitIds: [a], tx: 40, ty: 8 })).toEqual({ ok: false, reason: 'OutOfBounds' });
  });
});
