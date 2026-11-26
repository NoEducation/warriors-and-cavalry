import { describe, expect, it } from 'vitest';
import { GameMap } from '../src/sim/GameMap';
import { OBJECT_KINDS, ObjectKind } from '../src/sim/ObjectKind';
import { POPULATION_CONFIG } from '../src/sim/populationConfig';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';
import type { WorldChange } from '../src/sim/WorldCommand';

function flatWorld(): World {
  const size = 8;
  const tiles = new Uint8Array(size * size).fill(TileType.Grass);
  return new World(new GameMap(size, size, 1, new Float32Array((size + 1) * (size + 1)), tiles));
}

describe('Stump kind', () => {
  it('is a 1 x 1 object players cannot build', () => {
    expect(OBJECT_KINDS[ObjectKind.Stump]).toMatchObject({ name: 'Stump', width: 1, height: 1, buildable: false });
    expect(POPULATION_CONFIG.stumpTicks).toBe(600);
  });
});

describe('World stumps', () => {
  it('stay walkable, block building and cannot be demolished', () => {
    const world = flatWorld();
    const stump = world.spawn(ObjectKind.Stump, 3, 3);
    expect(world.isWalkable(3, 3)).toBe(true);
    expect(world.canPlace(ObjectKind.Hovel, 3, 3)).toMatchObject({ ok: false, reason: 'Occupied' });
    expect(world.apply({ type: 'demolish', objectId: stump.id })).toMatchObject({ ok: false, reason: 'NotDemolishable' });
  });

  it('count down and clear after stumpTicks, freeing the tile', () => {
    const world = flatWorld();
    const stump = world.spawn(ObjectKind.Stump, 3, 3);
    const changes: WorldChange[] = [];
    world.onChange((change) => changes.push(change));
    expect(world.stumpTicksLeft(stump.id)).toBe(600);
    world.tick();
    expect(world.stumpTicksLeft(stump.id)).toBe(599);
    for (let i = 1; i < 599; i++) world.tick();
    expect(world.objectAt(3, 3)).toBe(stump);
    world.tick();
    expect(world.objectAt(3, 3)).toBeUndefined();
    expect(world.stumpTicksLeft(stump.id)).toBe(0);
    expect(changes).toEqual([{ type: 'removed', object: stump }]);
    expect(world.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 3, ty: 3 }).ok).toBe(true);
  });

  it('report 0 ticks left for objects that are not stumps', () => {
    const world = flatWorld();
    const tree = world.spawn(ObjectKind.Tree, 1, 1);
    expect(world.stumpTicksLeft(tree.id)).toBe(0);
  });
});
