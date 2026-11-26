import { describe, expect, it } from 'vitest';
import { GameMap } from '../src/sim/GameMap';
import { Economy } from '../src/sim/Economy';
import { ObjectKind, OBJECT_KINDS } from '../src/sim/ObjectKind';
import { NO_RESOURCES, RESOURCE_KINDS, ResourceKind } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';
import type { CommandResult, ObjectCommandResult, WorldChange, WorldCommand } from '../src/sim/WorldCommand';

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
    const rows = Object.values(ObjectKind).map((kind) => {
      const { name, width, height, buildable } = OBJECT_KINDS[kind];
      return [name, width, height, buildable];
    });
    expect(rows).toEqual([
      ['Tree', 1, 1, false],
      ['Keep', 4, 4, true],
      ['Hovel', 2, 2, true],
      ["Woodcutter's hut", 2, 2, true],
      ['Stockpile', 3, 3, true],
      ['Granary', 3, 3, true],
      ['Quarry', 3, 3, true],
      ['Wheat farm', 4, 4, true],
      ['Wall', 1, 1, true],
      ['Gate', 1, 1, true],
      ['Tower', 2, 2, true],
    ]);
  });

  it('holds costs, storage, placement rules and production', () => {
    const rows = Object.values(ObjectKind).map((kind) => {
      const { cost, storage, grassOnly, quarryOnly, rockAllowed, housing, production } = OBJECT_KINDS[kind];
      const amounts = (r: typeof cost): number[] => RESOURCE_KINDS.map((k) => r[k]);
      return [amounts(cost), amounts(storage), grassOnly, quarryOnly, rockAllowed, housing, production];
    });
    const { Wood: wood, Stone: stone, Food: food } = ResourceKind;
    expect(rows).toEqual([
      [[0, 0, 0], [0, 0, 0], false, false, false, 0, null],
      [[50, 40, 0], [0, 0, 0], false, false, false, 4, null],
      [[15, 0, 0], [0, 0, 0], false, false, false, 4, null],
      [[20, 0, 0], [0, 0, 0], false, false, false, 0, { resource: wood, cycleTicks: 100, yield: 2, treeRadius: 8 }],
      [[10, 0, 0], [150, 150, 0], false, false, false, 0, null],
      [[25, 0, 0], [0, 0, 200], false, false, false, 0, null],
      [[30, 0, 0], [0, 0, 0], false, true, false, 0, { resource: stone, cycleTicks: 150, yield: 2, treeRadius: null }],
      [[20, 0, 0], [0, 0, 0], true, false, false, 0, { resource: food, cycleTicks: 200, yield: 3, treeRadius: null }],
      [[0, 2, 0], [0, 0, 0], false, false, true, 0, null],
      [[0, 6, 0], [0, 0, 0], false, false, true, 0, null],
      [[0, 20, 0], [0, 0, 0], false, false, true, 0, null],
    ]);
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

  it('allows a corner height range of 0.3 per tile of the longer footprint side, and at least 0.6', () => {
    const cases: [ObjectKind, number, number][] = [
      [ObjectKind.Wall, 0.6, 0.7], // 1 x 1: the 0.6 floor
      [ObjectKind.Hovel, 0.6, 0.7], // 2 x 2
      [ObjectKind.Stockpile, 0.9, 1.0], // 3 x 3
      [ObjectKind.Keep, 1.2, 1.3], // 4 x 4
    ];
    for (const [kind, okRange, steepRange] of cases) {
      const { width } = OBJECT_KINDS[kind];
      const edge = flatMap();
      setCorner(edge, 3 + width, 3 + width, okRange);
      expect(new World(edge).canPlace(kind, 3, 3), `${OBJECT_KINDS[kind].name} at ${okRange}`).toEqual({ ok: true });
      const steep = flatMap();
      setCorner(steep, 3 + width, 3 + width, steepRange);
      expect(new World(steep).canPlace(kind, 3, 3), `${OBJECT_KINDS[kind].name} at ${steepRange}`).toEqual({
        ok: false,
        reason: 'TooSteep',
      });
    }
  });

  it('places a Quarry only with every footprint tile on quarry ground', () => {
    expect(new World(flatMap()).canPlace(ObjectKind.Quarry, 5, 5)).toEqual({ ok: false, reason: 'NeedsQuarryGround' });
    const site = flatMap();
    for (let ty = 5; ty < 8; ty++) for (let tx = 5; tx < 8; tx++) setTile(site, tx, ty, TileType.Quarry);
    expect(new World(site).canPlace(ObjectKind.Quarry, 5, 5)).toEqual({ ok: true });
    expect(new World(site).canPlace(ObjectKind.Quarry, 6, 5)).toEqual({ ok: false, reason: 'NeedsQuarryGround' });
  });

  it('keeps every other building off quarry ground', () => {
    const site = flatMap();
    setTile(site, 4, 4, TileType.Quarry);
    for (const kind of [ObjectKind.Hovel, ObjectKind.Stockpile, ObjectKind.Wall, ObjectKind.Tower]) {
      expect(new World(site).canPlace(kind, 4, 4), OBJECT_KINDS[kind].name).toEqual({ ok: false, reason: 'BadTerrain' });
    }
  });

  it('places a Wheat farm only on grass', () => {
    const sandy = flatMap();
    setTile(sandy, 4, 4, TileType.Sand);
    expect(new World(sandy).canPlace(ObjectKind.WheatFarm, 3, 3)).toEqual({ ok: false, reason: 'BadTerrain' });
    expect(new World(flatMap()).canPlace(ObjectKind.WheatFarm, 3, 3)).toEqual({ ok: true });
  });

  it('does not look at resources', () => {
    const world = new World(flatMap(), new Economy(NO_RESOURCES));
    expect(world.canPlace(ObjectKind.Keep, 3, 3)).toEqual({ ok: true });
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

describe('World costs and storage', () => {
  const amounts = (world: World): number[] => RESOURCE_KINDS.map((k) => world.economy.amount(k));
  const capacities = (world: World): number[] => RESOURCE_KINDS.map((k) => world.economy.capacity(k));
  const place = (world: World, kind: ObjectKind, tx: number, ty: number): ObjectCommandResult =>
    world.apply({ type: 'placeBuilding', kind, tx, ty });

  it('spends the cost of a placed building', () => {
    const hovel = new World(flatMap());
    expect(place(hovel, ObjectKind.Hovel, 1, 1).ok).toBe(true);
    expect(amounts(hovel)).toEqual([85, 40, 50]);
    const keep = new World(flatMap());
    expect(place(keep, ObjectKind.Keep, 1, 1).ok).toBe(true);
    expect(amounts(keep)).toEqual([50, 0, 50]);
  });

  it('rejects a building it cannot pay for and changes nothing', () => {
    const world = new World(flatMap());
    place(world, ObjectKind.Keep, 0, 0);
    place(world, ObjectKind.WoodcutterHut, 5, 0);
    place(world, ObjectKind.WoodcutterHut, 8, 0);
    expect(amounts(world)).toEqual([10, 0, 50]);
    const changes = recordChanges(world);
    expect(place(world, ObjectKind.Hovel, 1, 8)).toEqual({ ok: false, reason: 'NotEnoughResources' });
    expect(world.objectCount).toBe(3);
    expect(world.objectAt(1, 8)).toBeUndefined();
    expect(amounts(world)).toEqual([10, 0, 50]);
    expect(changes).toEqual([]);
  });

  it('reports a placement rule before missing resources', () => {
    const world = new World(flatMap(), new Economy(NO_RESOURCES));
    expect(place(world, ObjectKind.Keep, SIZE - 3, 0)).toEqual({ ok: false, reason: 'OutOfBounds' });
  });

  it('refunds half the cost, rounded down, on demolish', () => {
    const world = new World(flatMap());
    const placed = place(world, ObjectKind.Hovel, 1, 1);
    if (!placed.ok) throw new Error('placement failed');
    world.apply({ type: 'demolish', objectId: placed.object.id });
    expect(amounts(world)).toEqual([92, 40, 50]);
  });

  it('raises capacity with a Stockpile and lowers it again on demolish', () => {
    const world = new World(flatMap());
    const placed = place(world, ObjectKind.Stockpile, 1, 1);
    if (!placed.ok) throw new Error('placement failed');
    expect(capacities(world)).toEqual([250, 250, 100]);
    world.apply({ type: 'demolish', objectId: placed.object.id });
    expect(capacities(world)).toEqual([100, 100, 100]);
    expect(amounts(world)).toEqual([95, 40, 50]);
  });

  it('raises food capacity with a Granary', () => {
    const world = new World(flatMap());
    expect(place(world, ObjectKind.Granary, 1, 1).ok).toBe(true);
    expect(capacities(world)).toEqual([100, 100, 300]);
  });

  it('loses the excess, refund included, when a full Stockpile is demolished', () => {
    const economy = new Economy();
    const world = new World(flatMap(), economy);
    const placed = place(world, ObjectKind.Stockpile, 1, 1);
    if (!placed.ok) throw new Error('placement failed');
    economy.add(ResourceKind.Wood, 150);
    expect(world.economy.amount(ResourceKind.Wood)).toBe(240);
    world.apply({ type: 'demolish', objectId: placed.object.id });
    expect(world.economy.amount(ResourceKind.Wood)).toBe(100);
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

describe('World walkability', () => {
  it('blocks water, buildings and the outside, but not trees or grass', () => {
    const map = flatMap();
    setTile(map, 1, 1, TileType.Water);
    const world = new World(map);
    world.spawn(ObjectKind.Hovel, 5, 5);
    world.spawn(ObjectKind.Tree, 9, 9);
    expect(world.isWalkable(1, 1)).toBe(false);
    for (const [tx, ty] of [[5, 5], [6, 5], [5, 6], [6, 6]]) expect(world.isWalkable(tx, ty)).toBe(false);
    expect(world.isWalkable(-1, 0)).toBe(false);
    expect(world.isWalkable(0, SIZE)).toBe(false);
    expect(world.isWalkable(9, 9)).toBe(true);
    expect(world.isWalkable(2, 2)).toBe(true);
  });

  it('lists the walkable edge tiles of a building', () => {
    const world = new World(flatMap());
    const hovel = world.spawn(ObjectKind.Hovel, 5, 5);
    expect(world.accessTiles(hovel.id)).toEqual([
      { tx: 5, ty: 4 }, { tx: 6, ty: 4 },
      { tx: 4, ty: 5 }, { tx: 7, ty: 5 },
      { tx: 4, ty: 6 }, { tx: 7, ty: 6 },
      { tx: 5, ty: 7 }, { tx: 6, ty: 7 },
    ]);
    world.spawn(ObjectKind.Hovel, 7, 6);
    const tiles = world.accessTiles(hovel.id);
    expect(tiles.length).toBe(7);
    expect(tiles).not.toContainEqual({ tx: 7, ty: 6 });
    expect(world.accessTiles(999)).toEqual([]);
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
