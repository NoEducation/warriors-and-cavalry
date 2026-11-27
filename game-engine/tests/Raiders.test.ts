import { describe, expect, it } from 'vitest';
import { ObjectKind } from '../src/sim/ObjectKind';
import { Side, UnitKind } from '../src/sim/UnitKind';
import type { World } from '../src/sim/World';
import type { WorldChange } from '../src/sim/WorldCommand';
import { combatWorld, place, run, runUntil } from './combatWorld';

const hp = (world: World, id: number): number | undefined => world.buildingHitPoints(id)?.current;

describe('raiders', () => {
  it('march on the Keep and strike it', () => {
    const world = combatWorld();
    const keep = place(world, ObjectKind.Keep, 10, 10);
    const raider = world.spawnUnit(Side.Raider, UnitKind.Spearman, 24, 11).id;
    runUntil(world, () => hp(world, keep.id)! < 600, 400);
    expect(hp(world, keep.id)).toBe(590);
    const r = world.unitById(raider)!;
    expect(r.target).toEqual({ type: 'building', id: keep.id });
    expect(Math.max(Math.abs(r.tx - 13), 0)).toBeLessThanOrEqual(1);
  });

  it('march on the nearest building when no Keep stands', () => {
    const world = combatWorld();
    const hovel = place(world, ObjectKind.Hovel, 4, 4);
    const granary = place(world, ObjectKind.Granary, 20, 20);
    world.spawnUnit(Side.Raider, UnitKind.Spearman, 28, 28);
    runUntil(world, () => hp(world, granary.id)! < 120, 400);
    expect(hp(world, hovel.id)).toBe(80);
  });

  it('kill a worker in 2 strikes; its building gets a new worker afterwards', () => {
    const world = combatWorld();
    place(world, ObjectKind.Keep, 2, 2);
    const farm = place(world, ObjectKind.WheatFarm, 12, 2);
    runUntil(world, () => [...world.peasants()].some((p) => p.state === 'working'), 400);
    const worker = [...world.peasants()][0];
    world.spawnUnit(Side.Raider, UnitKind.Spearman, worker.tx + 3, worker.ty + 3);
    runUntil(world, () => world.population.count === 0, 200);
    expect(worker.hitPoints).toBeLessThanOrEqual(0);
    runUntil(world, () => [...world.peasants()].some((p) => p.workplaceId === farm.id), 50);
    expect([...world.peasants()][0].id).not.toBe(worker.id);
  });

  it('kill a player Spearman, who fights back while it stands', () => {
    const world = combatWorld();
    const soldier = world.spawnUnit(Side.Player, UnitKind.Spearman, 5, 5).id;
    const raiders = [world.spawnUnit(Side.Raider, UnitKind.Spearman, 9, 5).id, world.spawnUnit(Side.Raider, UnitKind.Spearman, 9, 6).id];
    runUntil(world, () => world.unitById(soldier) === undefined, 400);
    const left = raiders.map((id) => world.unitById(id)?.hitPoints ?? 0);
    expect(left.some((h) => h < 60)).toBe(true);
  });

  it('wreck a Keep at 0 hit points: it is removed and the listeners hear of it', () => {
    const world = combatWorld();
    const keep = place(world, ObjectKind.Keep, 10, 10);
    const removed: WorldChange[] = [];
    world.onChange((c) => c.type === 'removed' && removed.push(c));
    for (let i = 0; i < 6; i++) world.spawnUnit(Side.Raider, UnitKind.Spearman, 20, 8 + i);
    runUntil(world, () => world.objectById(keep.id) === undefined, 2000);
    expect(removed.map((c) => c.object.id)).toEqual([keep.id]);
    expect(world.buildingHitPoints(keep.id)).toBeNull();
  });

  it('pick a new target when the worker they chase dies with its demolished building', () => {
    const world = combatWorld();
    const keep = place(world, ObjectKind.Keep, 2, 2);
    const farm = place(world, ObjectKind.WheatFarm, 16, 2);
    runUntil(world, () => [...world.peasants()].some((p) => p.state === 'working'), 400);
    const worker = [...world.peasants()][0];
    const raider = world.spawnUnit(Side.Raider, UnitKind.Spearman, worker.tx + 5, worker.ty + 5).id;
    runUntil(world, () => world.unitById(raider)?.target?.type === 'peasant', 20);
    world.apply({ type: 'demolish', objectId: farm.id });
    run(world, 5);
    expect(world.unitById(raider)?.target).toEqual({ type: 'building', id: keep.id });
  });
});
