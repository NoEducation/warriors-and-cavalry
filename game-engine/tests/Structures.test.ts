import { describe, expect, it } from 'vitest';
import { Economy } from '../src/sim/Economy';
import { GameMap } from '../src/sim/GameMap';
import { OBJECT_KINDS, ObjectKind } from '../src/sim/ObjectKind';
import { resources } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';

const SIZE = 16;

function flatWorld(): World {
  const tiles = new Uint8Array(SIZE * SIZE).fill(TileType.Grass);
  const map = new GameMap(SIZE, SIZE, 1, new Float32Array((SIZE + 1) * (SIZE + 1)), tiles);
  return new World(map, new Economy(resources(100, 100, 100)));
}

describe('building hit points', () => {
  it('gives every kind its hit points; trees and stumps cannot be attacked', () => {
    const expected: Record<number, number> = {
      [ObjectKind.Keep]: 600, [ObjectKind.Hovel]: 80, [ObjectKind.WoodcutterHut]: 80, [ObjectKind.Stockpile]: 80,
      [ObjectKind.Granary]: 120, [ObjectKind.Quarry]: 120, [ObjectKind.WheatFarm]: 80, [ObjectKind.Barracks]: 200,
      [ObjectKind.Wall]: 150, [ObjectKind.Gate]: 200, [ObjectKind.Tower]: 400, [ObjectKind.Stairs]: 60,
      [ObjectKind.Tree]: 0, [ObjectKind.Stump]: 0,
    };
    for (const kind of Object.values(ObjectKind)) expect(OBJECT_KINDS[kind].hitPoints, OBJECT_KINDS[kind].name).toBe(expected[kind]);
  });

  it('describes the Barracks: 3x3, 40 wood and 10 stone, room for 8 soldiers', () => {
    const info = OBJECT_KINDS[ObjectKind.Barracks];
    expect(info).toMatchObject({ name: 'Barracks', width: 3, height: 3, buildable: true, soldierRoom: 8, housing: 0 });
    expect(info.cost).toEqual(resources(40, 10, 0));
    expect(info.production).toBeNull();
    expect(OBJECT_KINDS[ObjectKind.Keep].soldierRoom).toBe(0);
  });

  it('reports a placed building at full hit points, nothing for trees, and forgets demolished buildings', () => {
    const world = flatWorld();
    const keep = world.apply({ type: 'placeBuilding', kind: ObjectKind.Keep, tx: 2, ty: 2 });
    if (!keep.ok) throw new Error(keep.reason);
    const tree = world.spawn(ObjectKind.Tree, 10, 10);
    expect(world.buildingHitPoints(keep.object.id)).toEqual({ current: 600, max: 600 });
    expect(world.buildingHitPoints(tree.id)).toBeNull();
    world.apply({ type: 'demolish', objectId: keep.object.id });
    expect(world.buildingHitPoints(keep.object.id)).toBeNull();
  });
});
