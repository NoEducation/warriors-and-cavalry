import { describe, expect, it } from 'vitest';
import { ObjectKind } from '../src/sim/ObjectKind';
import { waveArchers, waveSize } from '../src/sim/RaidSchedule';
import { Side, UnitKind } from '../src/sim/UnitKind';
import type { World } from '../src/sim/World';
import { combatWorld, place, run, runUntil } from './combatWorld';

const raiders = (world: World) => [...world.units()].filter((u) => u.side === Side.Raider);

describe('raid schedule', () => {
  it('sizes wave n at n + 1 raiders, floor(n / 2) of them Archers', () => {
    expect([1, 2, 3, 4, 5].map(waveSize)).toEqual([2, 3, 4, 5, 6]);
    expect([1, 2, 3, 4, 5].map(waveArchers)).toEqual([0, 1, 1, 2, 2]);
  });

  it('sends no raiders while no Keep stands', () => {
    const world = combatWorld(128);
    expect(world.raids).toEqual({ wave: 0, ticksToNextWave: null, keepFallen: false, raidersAlive: 0 });
    run(world, 4000);
    expect(raiders(world)).toHaveLength(0);
  });

  it('sends wave 1 about 48 tiles from the Keep 3000 ticks after it is placed, then a bigger one every 1800', () => {
    const world = combatWorld(128);
    place(world, ObjectKind.Keep, 60, 60);
    expect(world.raids.ticksToNextWave).toBe(3000);
    run(world, 2999);
    expect(raiders(world)).toHaveLength(0);
    run(world, 1);
    const first = raiders(world);
    expect(first.map((u) => u.kind)).toEqual([UnitKind.Spearman, UnitKind.Spearman]);
    expect(world.raids).toMatchObject({ wave: 1, ticksToNextWave: 1800, raidersAlive: 2 });
    const d = Math.max(Math.abs(first[0].tx - 62), Math.abs(first[0].ty - 62));
    expect(d).toBeGreaterThanOrEqual(40);
    expect(d).toBeLessThanOrEqual(56);
    for (let i = 0; i < 4; i++) world.spawnUnit(Side.Player, UnitKind.Spearman, 59 + i, 65); // defenders, so the Keep stands
    run(world, 1800);
    expect(raiders(world).filter((u) => u.id > first[1].id + 4).map((u) => u.kind)).toEqual([
      UnitKind.Spearman,
      UnitKind.Spearman,
      UnitKind.Archer,
    ]);
  });

  it('marks the Keep fallen when raiders wreck it, stops the timer, and starts over when a Keep is built again', () => {
    const world = combatWorld(64);
    const keep = place(world, ObjectKind.Keep, 20, 20);
    for (let i = 0; i < 8; i++) world.spawnUnit(Side.Raider, UnitKind.Spearman, 30, 18 + i);
    runUntil(world, () => world.objectById(keep.id) === undefined, 2000);
    expect(world.raids).toMatchObject({ ticksToNextWave: null, keepFallen: true });
    place(world, ObjectKind.Keep, 4, 40);
    expect(world.raids).toMatchObject({ wave: 0, ticksToNextWave: 3000, keepFallen: false });
  });

  it('does not count a demolished Keep as fallen', () => {
    const world = combatWorld(64);
    const keep = place(world, ObjectKind.Keep, 20, 20);
    world.apply({ type: 'demolish', objectId: keep.id });
    expect(world.raids).toMatchObject({ ticksToNextWave: null, keepFallen: false });
  });

  it('sends a wave to the same tile in two worlds of the same seed', () => {
    const tileOf = (seed: number): [number, number] => {
      const world = combatWorld(128, () => false, seed);
      place(world, ObjectKind.Keep, 60, 60);
      run(world, 3000);
      const [r] = raiders(world);
      return [r.tx, r.ty];
    };
    expect(tileOf(7)).toEqual(tileOf(7));
  });
});
