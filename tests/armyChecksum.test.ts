import { describe, expect, it } from 'vitest';
import { ObjectKind } from '../src/sim/ObjectKind';
import { Side, UnitKind } from '../src/sim/UnitKind';
import type { World } from '../src/sim/World';
import { worldChecksum } from '../src/sim/worldChecksum';
import { combatWorld, place, run } from './combatWorld';

/** A camp with a Keep and a Barracks training two soldiers, on a 128 map so raid waves come. */
function camp(): World {
  const world = combatWorld(128, () => false, 5);
  place(world, ObjectKind.Keep, 60, 60);
  const barracks = place(world, ObjectKind.Barracks, 60, 66);
  world.apply({ type: 'trainUnit', barracksId: barracks.id, unitKind: UnitKind.Spearman });
  world.apply({ type: 'trainUnit', barracksId: barracks.id, unitKind: UnitKind.Archer });
  return world;
}

describe('the checksum of a fight', () => {
  it('stays equal for two equal worlds given the same commands over a raid', () => {
    const [a, b] = [camp(), camp()];
    for (const world of [a, b]) {
      run(world, 300);
      const ids = [...world.units()].map((u) => u.id);
      world.apply({ type: 'orderMove', unitIds: ids, tx: 62, ty: 70 });
      run(world, 5700);
    }
    expect(a.raids.wave).toBeGreaterThanOrEqual(1);
    expect(worldChecksum(a)).toBe(worldChecksum(b));
  });

  it('changes with one more order', () => {
    const [a, b] = [camp(), camp()];
    run(a, 300);
    run(b, 300);
    const ids = [...b.units()].map((u) => u.id);
    b.apply({ type: 'orderMove', unitIds: ids, tx: 62, ty: 75 });
    expect(worldChecksum(a)).not.toBe(worldChecksum(b));
  });

  it('covers building and peasant hit points, units and training queues', () => {
    const [a, b] = [combatWorld(32), combatWorld(32)];
    for (const world of [a, b]) {
      place(world, ObjectKind.Keep, 2, 2);
      place(world, ObjectKind.WheatFarm, 12, 2);
    }
    const sum = (): [number, number] => [worldChecksum(a), worldChecksum(b)];
    expect(sum()[0]).toBe(sum()[1]);
    b.spawnUnit(Side.Raider, UnitKind.Archer, 20, 20);
    expect(sum()[0]).not.toBe(sum()[1]);
    a.spawnUnit(Side.Raider, UnitKind.Archer, 20, 20);
    expect(sum()[0]).toBe(sum()[1]);
    run(a, 300);
    run(b, 300);
    expect([...a.units()][0].lastStrikeTick).toBeGreaterThanOrEqual(0);
    expect(sum()[0]).toBe(sum()[1]);
  });
});
