import { describe, expect, it } from 'vitest';
import { GameMap } from '../src/sim/GameMap';
import { ObjectKind, OBJECT_KINDS } from '../src/sim/ObjectKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';
import type { CommandResult, WorldChange, WorldCommand } from '../src/sim/WorldCommand';

const SIZE = 16;

/** A flat SIZE x SIZE map of `tile` tiles at height 0. */
function flatMap(tile: TileType = TileType.Grass): GameMap {
  const heights = new Float32Array((SIZE + 1) * (SIZE + 1));
  const tiles = new Uint8Array(SIZE * SIZE).fill(tile);
  return new GameMap(SIZE, SIZE, 1, heights, tiles);
}

function setTile(map: GameMap, tx: number, ty: number, tile: TileType): void {
  map.tiles[ty * map.width + tx] = tile;
}

function setCorner(map: GameMap, cx: number, cy: number, h: number): void {
  map.heights[cy * (map.width + 1) + cx] = h;
}

function recordChanges(world: World): WorldChange[] {
  const changes: WorldChange[] = [];
  world.onChange((c) => changes.push(c));
  return changes;
}

describe('OBJECT_KINDS', () => {
  it('describes footprints and buildability', () => {
    expect(OBJECT_KINDS[ObjectKind.Tree]).toEqual({ name: 'Tree', width: 1, height: 1, buildable: false });
    expect(OBJECT_KINDS[ObjectKind.Keep]).toEqual({ name: 'Keep', width: 4, height: 4, buildable: true });
    expect(OBJECT_KINDS[ObjectKind.Hovel]).toEqual({ name: 'Hovel', width: 2, height: 2, buildable: true });
    expect(OBJECT_KINDS[ObjectKind.WoodcutterHut]).toEqual({
      name: "Woodcutter's hut",
      width: 2,
      height: 2,
      buildable: true,
    });
  });
});

describe('World.canPlace', () => {
  it('accepts a Hovel on flat grass and on sand', () => {
    expect(new World(flatMap()).canPlace(ObjectKind.Hovel, 3, 3)).toEqual({ ok: true });
    expect(new World(flatMap(TileType.Sand)).canPlace(ObjectKind.Hovel, 3, 3)).toEqual({ ok: true });
  });

  it('rejects non-buildable kinds', () => {
    expect(new World(flatMap()).canPlace(ObjectKind.Tree, 3, 3)).toEqual({ ok: false, reason: 'NotBuildable' });
  });

  it('rejects an unknown kind without throwing', () => {
    const world = new World(flatMap());
    expect(world.canPlace(99 as ObjectKind, 1, 1)).toEqual({ ok: false, reason: 'NotBuildable' });
  });

  it('rejects footprints outside the map', () => {
    const world = new World(flatMap());
    expect(world.canPlace(ObjectKind.Keep, SIZE - 3, 0)).toEqual({ ok: false, reason: 'OutOfBounds' });
    expect(world.canPlace(ObjectKind.Keep, SIZE - 4, SIZE - 4)).toEqual({ ok: true });
    expect(world.canPlace(ObjectKind.Hovel, -1, 0)).toEqual({ ok: false, reason: 'OutOfBounds' });
    expect(world.canPlace(ObjectKind.Hovel, 0, -1)).toEqual({ ok: false, reason: 'OutOfBounds' });
    expect(world.canPlace(ObjectKind.Hovel, 1.5, 0)).toEqual({ ok: false, reason: 'OutOfBounds' });
    expect(world.canPlace(ObjectKind.Hovel, 0, Number.NaN)).toEqual({ ok: false, reason: 'OutOfBounds' });
  });

  it('rejects water and rock in the footprint', () => {
    for (const tile of [TileType.Water, TileType.Rock]) {
      const map = flatMap();
      setTile(map, 4, 4, tile);
      expect(new World(map).canPlace(ObjectKind.Hovel, 3, 3)).toEqual({ ok: false, reason: 'BadTerrain' });
    }
  });

  it('rejects overlapping an existing object by one tile', () => {
    const world = new World(flatMap());
    world.spawn(ObjectKind.Tree, 4, 4);
    expect(world.canPlace(ObjectKind.Hovel, 3, 3)).toEqual({ ok: false, reason: 'Occupied' });
    expect(world.canPlace(ObjectKind.Hovel, 5, 5)).toEqual({ ok: true });
  });

  it('rejects a footprint whose corner heights differ by more than 0.6', () => {
    const steep = flatMap();
    setCorner(steep, 5, 5, 0.7);
    expect(new World(steep).canPlace(ObjectKind.Hovel, 3, 3)).toEqual({ ok: false, reason: 'TooSteep' });
    const edge = flatMap();
    setCorner(edge, 5, 5, 0.6);
    expect(new World(edge).canPlace(ObjectKind.Hovel, 3, 3)).toEqual({ ok: true });
  });

  it('reports BadTerrain before Occupied', () => {
    const map = flatMap();
    setTile(map, 4, 4, TileType.Rock);
    const world = new World(map);
    world.spawn(ObjectKind.Tree, 4, 4);
    expect(world.canPlace(ObjectKind.Hovel, 3, 3)).toEqual({ ok: false, reason: 'BadTerrain' });
  });
});

describe('World.apply', () => {
  it('places a building on all its footprint tiles and notifies once', () => {
    const world = new World(flatMap());
    const changes = recordChanges(world);
    const result = world.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 3, ty: 3 });
    const expected = { id: 1, kind: ObjectKind.Hovel, tx: 3, ty: 3 };
    expect(result).toEqual({ ok: true, object: expected });
    for (const [tx, ty] of [
      [3, 3],
      [4, 3],
      [3, 4],
      [4, 4],
    ]) {
      expect(world.objectAt(tx, ty)).toEqual(expected);
    }
    expect(world.objectAt(5, 3)).toBeUndefined();
    expect(world.objectAt(3, 5)).toBeUndefined();
    expect(world.objectAt(2, 3)).toBeUndefined();
    expect(world.objectCount).toBe(1);
    expect(changes).toEqual([{ type: 'added', object: expected }]);
  });

  it('changes nothing and notifies nobody when placement fails', () => {
    const world = new World(flatMap());
    const changes = recordChanges(world);
    const result = world.apply({ type: 'placeBuilding', kind: ObjectKind.Keep, tx: SIZE - 3, ty: 0 });
    expect(result).toEqual({ ok: false, reason: 'OutOfBounds' });
    expect(world.objectCount).toBe(0);
    expect(changes).toEqual([]);
    expect(world.objectAt(SIZE - 3, 0)).toBeUndefined();
  });

  it('rejects a placement of an unknown kind without throwing or changing anything', () => {
    const world = new World(flatMap());
    const changes = recordChanges(world);
    const command = { type: 'placeBuilding', kind: 99 as ObjectKind, tx: 1, ty: 1 } as WorldCommand;
    let result: CommandResult | undefined;
    expect(() => (result = world.apply(command))).not.toThrow();
    expect(result).toEqual({ ok: false, reason: 'NotBuildable' });
    expect(world.objectCount).toBe(0);
    expect(world.objectAt(1, 1)).toBeUndefined();
    expect(changes).toEqual([]);
  });

  it('rejects an unknown command type without throwing or changing anything', () => {
    const world = new World(flatMap());
    world.spawn(ObjectKind.Tree, 2, 2);
    const changes = recordChanges(world);
    let result: CommandResult | undefined;
    expect(() => (result = world.apply({ type: 'nonsense' } as unknown as WorldCommand))).not.toThrow();
    expect(result).toEqual({ ok: false, reason: 'UnknownCommand' });
    expect(world.objectCount).toBe(1);
    expect(changes).toEqual([]);
  });

  it('demolishes a building, freeing its tiles, and never reuses its id', () => {
    const world = new World(flatMap());
    const placed = world.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 3, ty: 3 });
    if (!placed.ok) throw new Error('placement failed');
    const changes = recordChanges(world);
    const result = world.apply({ type: 'demolish', objectId: placed.object.id });
    expect(result).toEqual({ ok: true, object: placed.object });
    expect(changes).toEqual([{ type: 'removed', object: placed.object }]);
    expect(world.objectCount).toBe(0);
    for (const [tx, ty] of [
      [3, 3],
      [4, 3],
      [3, 4],
      [4, 4],
    ]) {
      expect(world.objectAt(tx, ty)).toBeUndefined();
    }
    const again = world.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 3, ty: 3 });
    expect(again).toEqual({ ok: true, object: { id: 2, kind: ObjectKind.Hovel, tx: 3, ty: 3 } });
  });

  it('rejects demolishing unknown objects, trees and already demolished buildings', () => {
    const world = new World(flatMap());
    expect(world.apply({ type: 'demolish', objectId: 99 })).toEqual({ ok: false, reason: 'UnknownObject' });
    const tree = world.spawn(ObjectKind.Tree, 0, 0);
    expect(world.apply({ type: 'demolish', objectId: tree.id })).toEqual({ ok: false, reason: 'NotDemolishable' });
    expect(world.objectAt(0, 0)).toEqual(tree);
    const placed = world.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 3, ty: 3 });
    if (!placed.ok) throw new Error('placement failed');
    expect(world.apply({ type: 'demolish', objectId: placed.object.id }).ok).toBe(true);
    expect(world.apply({ type: 'demolish', objectId: placed.object.id })).toEqual({
      ok: false,
      reason: 'UnknownObject',
    });
  });
});

describe('World.spawn and listeners', () => {
  it('spawns objects with increasing ids, iterated in id order', () => {
    const world = new World(flatMap());
    const changes = recordChanges(world);
    const a = world.spawn(ObjectKind.Tree, 1, 1);
    const b = world.spawn(ObjectKind.Tree, 0, 0);
    expect([a.id, b.id]).toEqual([1, 2]);
    expect(Array.from(world.objects())).toEqual([a, b]);
    expect(changes).toEqual([
      { type: 'added', object: a },
      { type: 'added', object: b },
    ]);
  });

  it('throws a RangeError when spawning on an occupied tile or outside the map', () => {
    const world = new World(flatMap());
    world.spawn(ObjectKind.Tree, 2, 2);
    expect(() => world.spawn(ObjectKind.Tree, 2, 2)).toThrow(RangeError);
    expect(() => world.spawn(ObjectKind.Tree, SIZE, 0)).toThrow(RangeError);
    expect(world.objectCount).toBe(1);
  });

  it('returns undefined from objectAt outside the map', () => {
    const world = new World(flatMap());
    expect(world.objectAt(-1, 0)).toBeUndefined();
    expect(world.objectAt(SIZE, 0)).toBeUndefined();
  });

  it('stops notifying after unsubscribe', () => {
    const world = new World(flatMap());
    const changes: WorldChange[] = [];
    const unsubscribe = world.onChange((c) => changes.push(c));
    world.spawn(ObjectKind.Tree, 1, 1);
    unsubscribe();
    world.spawn(ObjectKind.Tree, 2, 2);
    expect(changes.length).toBe(1);
  });
});

describe('World.tick', () => {
  it('counts ticks from zero', () => {
    const world = new World(flatMap());
    expect(world.tickCount).toBe(0);
    world.tick();
    world.tick();
    world.tick();
    expect(world.tickCount).toBe(3);
  });
});
