import { describe, expect, it } from 'vitest';
import { ObjectKind } from '../src/sim/ObjectKind';
import { ResourceKind, resources } from '../src/sim/ResourceKind';
import { Side, UnitKind } from '../src/sim/UnitKind';
import { combatWorld, place, run } from './combatWorld';

const train = (world: ReturnType<typeof combatWorld>, barracksId: number, unitKind: number = UnitKind.Spearman) =>
  world.apply({ type: 'trainUnit', barracksId, unitKind: unitKind as UnitKind });

describe('Barracks training', () => {
  it('gives room for 8 soldiers per Barracks, and none without one', () => {
    const world = combatWorld();
    expect(world.soldiers).toEqual({ count: 0, room: 0 });
    place(world, ObjectKind.Barracks, 4, 4);
    expect(world.soldiers).toEqual({ count: 0, room: 8 });
  });

  it('pays the cost and, after the training ticks, puts an idle Spearman on the first access tile', () => {
    const world = combatWorld();
    const barracks = place(world, ObjectKind.Barracks, 4, 4);
    const wood = world.economy.amount(ResourceKind.Wood);
    expect(train(world, barracks.id)).toEqual({ ok: true, queued: 1 });
    expect(world.economy.amount(ResourceKind.Food)).toBe(90);
    expect(world.economy.amount(ResourceKind.Wood)).toBe(wood - 5);
    expect(world.trainingQueue(barracks.id)).toEqual({ kinds: [UnitKind.Spearman], progress: 0 });
    run(world, 99);
    expect([...world.units()]).toHaveLength(0);
    run(world, 1);
    const units = [...world.units()];
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ side: Side.Player, kind: UnitKind.Spearman, hitPoints: 60, order: 'idle', tx: 4, ty: 7 });
    expect(world.trainingQueue(barracks.id)).toEqual({ kinds: [], progress: 0 });
    expect(world.soldiers).toEqual({ count: 1, room: 8 });
    expect(world.population.count).toBe(0);
  });

  it('trains the queue front first, an Archer taking 120 ticks', () => {
    const world = combatWorld();
    const barracks = place(world, ObjectKind.Barracks, 4, 4);
    train(world, barracks.id, UnitKind.Archer);
    train(world, barracks.id, UnitKind.Spearman);
    run(world, 120);
    expect([...world.units()].map((u) => u.kind)).toEqual([UnitKind.Archer]);
    run(world, 100);
    expect([...world.units()].map((u) => u.kind)).toEqual([UnitKind.Archer, UnitKind.Spearman]);
  });

  it('refuses a soldier over the room (queued ones count), a sixth in the queue, and a non-Barracks, changing nothing', () => {
    const world = combatWorld(32);
    const barracks = place(world, ObjectKind.Barracks, 4, 4);
    for (let i = 0; i < 5; i++) expect(train(world, barracks.id).ok).toBe(true);
    const food = world.economy.amount(ResourceKind.Food);
    expect(train(world, barracks.id)).toEqual({ ok: false, reason: 'QueueFull' });
    run(world, 500);
    for (let i = 0; i < 3; i++) expect(train(world, barracks.id).ok).toBe(true);
    expect(train(world, barracks.id)).toEqual({ ok: false, reason: 'NoSoldierRoom' });
    const hovel = place(world, ObjectKind.Hovel, 20, 20);
    expect(train(world, hovel.id)).toEqual({ ok: false, reason: 'NotABarracks' });
    expect(train(world, 999)).toEqual({ ok: false, reason: 'UnknownObject' });
    expect(train(world, barracks.id, 7)).toEqual({ ok: false, reason: 'UnknownUnitKind' });
    expect(world.economy.amount(ResourceKind.Food)).toBe(food - 30);
  });

  it('refuses a soldier the food cannot pay for', () => {
    const world = combatWorld(32, () => false, 1, resources(100, 100, 8));
    const barracks = place(world, ObjectKind.Barracks, 4, 4);
    expect(train(world, barracks.id)).toEqual({ ok: false, reason: 'NotEnoughResources' });
    expect(world.economy.amount(ResourceKind.Food)).toBe(8);
    expect(world.economy.amount(ResourceKind.Wood)).toBe(60);
    expect(world.trainingQueue(barracks.id)).toEqual({ kinds: [], progress: 0 });
  });

  it('drops the queue and the room when the Barracks is demolished; trained soldiers stay', () => {
    const world = combatWorld();
    const barracks = place(world, ObjectKind.Barracks, 4, 4);
    train(world, barracks.id);
    run(world, 100);
    train(world, barracks.id);
    world.apply({ type: 'demolish', objectId: barracks.id });
    expect(world.soldiers).toEqual({ count: 1, room: 0 });
    expect(world.trainingQueue(barracks.id)).toBeNull();
    run(world, 200);
    expect([...world.units()]).toHaveLength(1);
  });

  it('holds a finished soldier while every access tile is built over, and lets it out when one frees', () => {
    const world = combatWorld(16, (tx, ty) => tx < 2 || ty < 2 || tx > 6 || ty > 6);
    const barracks = place(world, ObjectKind.Barracks, 3, 3);
    // The ring of tiles round the Barracks (2..6) is the only land left; cover it with walls.
    const walls = [];
    for (let t = 2; t <= 6; t++) {
      walls.push(world.apply({ type: 'placeWallLine', fromTx: 2, fromTy: t, toTx: 2, toTy: t }));
      walls.push(world.apply({ type: 'placeWallLine', fromTx: 6, fromTy: t, toTx: 6, toTy: t }));
    }
    for (let t = 3; t <= 5; t++) {
      world.apply({ type: 'placeWallLine', fromTx: t, fromTy: 2, toTx: t, toTy: 2 });
      world.apply({ type: 'placeWallLine', fromTx: t, fromTy: 6, toTx: t, toTy: 6 });
    }
    expect(world.accessTiles(barracks.id)).toEqual([]);
    train(world, barracks.id);
    run(world, 150);
    expect([...world.units()]).toHaveLength(0);
    expect(world.trainingQueue(barracks.id)).toEqual({ kinds: [UnitKind.Spearman], progress: 100 });
    const piece = world.objectAt(4, 6);
    if (!piece) throw new Error('no wall piece');
    world.apply({ type: 'demolish', objectId: piece.id });
    run(world, 1);
    expect([...world.units()].map((u) => [u.tx, u.ty])).toEqual([[4, 6]]);
  });
});
