import { describe, expect, it } from 'vitest';
import { Economy } from '../src/sim/Economy';
import { GameMap } from '../src/sim/GameMap';
import type { MapObject } from '../src/sim/MapObject';
import { ObjectKind } from '../src/sim/ObjectKind';
import type { PeasantView } from '../src/sim/PeasantView';
import { ResourceKind, resources } from '../src/sim/ResourceKind';
import type { TileCoord } from '../src/sim/TileCoord';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';
import type { WorldChange, WorldCommand } from '../src/sim/WorldCommand';
import { worldChecksum } from '../src/sim/worldChecksum';

const SIZE = 32;
const STONE = ResourceKind.Stone;

/** A flat SIZE x SIZE map of `tile` tiles at height 0. */
function flatMap(tile: TileType = TileType.Grass): GameMap {
  const tiles = new Uint8Array(SIZE * SIZE).fill(tile);
  return new GameMap(SIZE, SIZE, 1, new Float32Array((SIZE + 1) * (SIZE + 1)), tiles);
}

function place(world: World, kind: ObjectKind, tx: number, ty: number): MapObject {
  const result = world.apply({ type: 'placeBuilding', kind, tx, ty });
  if (!result.ok) throw new Error(`placement failed: ${result.reason}`);
  return result.object;
}

function line(fromTx: number, fromTy: number, toTx: number, toTy: number): WorldCommand {
  return { type: 'placeWallLine', fromTx, fromTy, toTx, toTy };
}

/** Applies a wall line that must place every one of its tiles. */
function wall(world: World, fromTx: number, fromTy: number, toTx: number, toTy: number): void {
  const result = world.apply(line(fromTx, fromTy, toTx, toTy));
  if (!result.ok || !('placed' in result) || result.skipped + result.unpaid > 0) {
    throw new Error(`wall line not fully placed: ${JSON.stringify(result)}`);
  }
}

function recordChanges(world: World): WorldChange[] {
  const changes: WorldChange[] = [];
  world.onChange((c) => changes.push(c));
  return changes;
}

function tickUntil(world: World, done: () => boolean, max = 3000): void {
  for (let n = 0; n < max; n++) {
    world.tick();
    if (done()) return;
  }
  throw new Error('condition not reached');
}

const first = (world: World): PeasantView | undefined => [...world.peasants()].find((p) => p.id === 1);
const at = (tx: number, ty: number): TileCoord => ({ tx, ty });

describe('wall placement rules', () => {
  it('lets a Wall, Gate and Tower stand on rock, but not a Hovel', () => {
    const world = new World(flatMap(TileType.Rock));
    expect(world.canPlace(ObjectKind.Wall, 3, 3)).toEqual({ ok: true });
    expect(world.canPlace(ObjectKind.Gate, 3, 3)).toEqual({ ok: true });
    expect(world.canPlace(ObjectKind.Tower, 3, 3)).toEqual({ ok: true });
    expect(world.canPlace(ObjectKind.Hovel, 3, 3)).toEqual({ ok: false, reason: 'BadTerrain' });
  });

  it('allows a one-tile Wall a height range of 0.6, not 0.7', () => {
    const ok = flatMap();
    ok.heights[4 * (SIZE + 1) + 4] = 0.6;
    expect(new World(ok).canPlace(ObjectKind.Wall, 3, 3)).toEqual({ ok: true });
    const steep = flatMap();
    steep.heights[4 * (SIZE + 1) + 4] = 0.7;
    expect(new World(steep).canPlace(ObjectKind.Wall, 3, 3)).toEqual({ ok: false, reason: 'TooSteep' });
  });

  it('lets walkers through a Gate tile but not a Wall or Tower tile', () => {
    const world = new World(flatMap(), new Economy(resources(0, 100, 0)));
    place(world, ObjectKind.Gate, 2, 2);
    place(world, ObjectKind.Wall, 4, 2);
    place(world, ObjectKind.Tower, 6, 2);
    expect(world.isWalkable(2, 2)).toBe(true);
    expect(world.isWalkable(4, 2)).toBe(false);
    expect(world.isWalkable(7, 3)).toBe(false);
  });
});

describe('placeWallLine', () => {
  /** Applies the line, checking that the preview taken just before agrees with the command. */
  function applyLine(world: World, command: WorldCommand & { type: 'placeWallLine' }): ReturnType<World['apply']> {
    const preview = world.previewWallLine(at(command.fromTx, command.fromTy), at(command.toTx, command.toTy));
    const stoneBefore = world.economy.amount(STONE);
    const result = world.apply(command);
    const placed = result.ok && 'placed' in result ? result.placed : 0;
    expect(preview.placedCount).toBe(placed);
    expect(preview.placeable.filter(Boolean)).toHaveLength(placed);
    expect(preview.tiles).toHaveLength(preview.placeable.length);
    expect(preview.cost[STONE]).toBe(stoneBefore - world.economy.amount(STONE));
    expect(preview.cost[STONE]).toBe(2 * placed);
    return result;
  }

  const lineCommand = (fromTx: number, fromTy: number, toTx: number, toTy: number) =>
    ({ type: 'placeWallLine', fromTx, fromTy, toTx, toTy }) as const;

  it('places every piece it can pay for, in tile order', () => {
    const world = new World(flatMap(), new Economy(resources(0, 10, 0)));
    const changes = recordChanges(world);
    expect(applyLine(world, lineCommand(5, 5, 9, 5))).toEqual({ ok: true, placed: 5, skipped: 0, unpaid: 0 });
    expect(world.economy.amount(STONE)).toBe(0);
    expect(changes.map((c) => [c.type, c.object.kind, c.object.tx, c.object.ty])).toEqual(
      [5, 6, 7, 8, 9].map((tx) => ['added', ObjectKind.Wall, tx, 5]),
    );
  });

  it('stops at the first piece it cannot pay for', () => {
    const world = new World(flatMap(), new Economy(resources(0, 6, 0)));
    expect(applyLine(world, lineCommand(5, 5, 9, 5))).toEqual({ ok: true, placed: 3, skipped: 0, unpaid: 2 });
    expect(world.economy.amount(STONE)).toBe(0);
    expect(world.objectAt(8, 5)).toBeUndefined();
  });

  it('skips occupied tiles', () => {
    const treeWorld = new World(flatMap(), new Economy(resources(0, 10, 0)));
    treeWorld.spawn(ObjectKind.Tree, 7, 5);
    expect(applyLine(treeWorld, lineCommand(5, 5, 9, 5))).toEqual({ ok: true, placed: 4, skipped: 1, unpaid: 0 });
    // A 2 x 2 Hovel at (7, 5) covers (7, 5) and (8, 5) of the line.
    const hovelWorld = new World(flatMap(), new Economy(resources(0, 10, 0)));
    hovelWorld.spawn(ObjectKind.Hovel, 7, 5);
    expect(applyLine(hovelWorld, lineCommand(5, 5, 9, 5))).toEqual({ ok: true, placed: 3, skipped: 2, unpaid: 0 });
  });

  it('fails with NotEnoughResources when valid tiles cannot be paid, changing nothing', () => {
    const world = new World(flatMap(), new Economy(resources(0, 0, 0)));
    world.spawn(ObjectKind.Tree, 5, 5);
    const changes = recordChanges(world);
    const checksum = worldChecksum(world);
    expect(applyLine(world, lineCommand(5, 5, 9, 5))).toEqual({ ok: false, reason: 'NotEnoughResources' });
    expect(world.objectCount).toBe(1);
    expect(worldChecksum(world)).toBe(checksum);
    expect(changes).toEqual([]);
  });

  it("fails with the first tile's reason when no tile is valid", () => {
    const world = new World(flatMap(TileType.Water), new Economy(resources(0, 10, 0)));
    const changes = recordChanges(world);
    expect(applyLine(world, lineCommand(5, 5, 9, 5))).toEqual({ ok: false, reason: 'BadTerrain' });
    expect(world.economy.amount(STONE)).toBe(10);
    expect(changes).toEqual([]);
  });

  it('places the on-map tiles of a line that starts off the map', () => {
    const world = new World(flatMap(), new Economy(resources(0, 20, 0)));
    expect(applyLine(world, lineCommand(-3, 5, 2, 5))).toEqual({ ok: true, placed: 3, skipped: 3, unpaid: 0 });
    for (const tx of [0, 1, 2]) expect(world.objectAt(tx, 5)?.kind).toBe(ObjectKind.Wall);
    const preview = world.previewWallLine(at(-3, 5), at(2, 5));
    expect(preview.placeable).toEqual([false, false, false, false, false, false]); // all built now
  });

  describe('rejects a wall line whose coordinates are not safe integers as UnknownCommand, changing nothing', () => {
    const malformed: [string, WorldCommand][] = [
      ['a fractional from', { type: 'placeWallLine', fromTx: 1.5, fromTy: 2, toTx: 4, toTy: 2 }],
      ['toTx NaN', { type: 'placeWallLine', fromTx: 1, fromTy: 2, toTx: Number.NaN, toTy: 2 }],
      ['toTy missing', { type: 'placeWallLine', fromTx: 1, fromTy: 2, toTx: 4 } as unknown as WorldCommand],
      ['fromTx 1e300', { type: 'placeWallLine', fromTx: 1e300, fromTy: 2, toTx: 4, toTy: 2 }],
    ];
    for (const [name, command] of malformed) {
      it(name, () => {
        const world = new World(flatMap(), new Economy(resources(0, 10, 0)));
        const changes = recordChanges(world);
        expect(world.apply(command)).toEqual({ ok: false, reason: 'UnknownCommand' });
        expect(world.objectCount).toBe(0);
        expect(world.economy.amount(STONE)).toBe(10);
        expect(changes).toEqual([]);
      });
    }
  });

  it('does not place a Wall or a Hovel on a Gate tile', () => {
    const world = new World(flatMap(), new Economy(resources(100, 100, 0)));
    place(world, ObjectKind.Gate, 5, 5);
    const command = (kind: ObjectKind): WorldCommand => ({ type: 'placeBuilding', kind, tx: 5, ty: 5 });
    expect(world.apply(command(ObjectKind.Wall))).toEqual({ ok: false, reason: 'Occupied' });
    expect(world.apply(command(ObjectKind.Hovel))).toEqual({ ok: false, reason: 'Occupied' });
    expect(world.objectCount).toBe(1);
  });

  it('previews without changing anything', () => {
    const world = new World(flatMap(), new Economy(resources(0, 6, 0)));
    const changes = recordChanges(world);
    const preview = world.previewWallLine(at(5, 5), at(9, 5));
    expect(preview.tiles).toEqual([5, 6, 7, 8, 9].map((tx) => at(tx, 5)));
    expect(preview.placeable).toEqual([true, true, true, false, false]);
    expect(preview.placedCount).toBe(3);
    expect(world.objectCount).toBe(0);
    expect(world.economy.amount(STONE)).toBe(6);
    expect(changes).toEqual([]);
  });
});

describe('walls and peasants', () => {
  /**
   * A Keep at (10, 10) inside a ring of walls on x, y in 7..16, a Woodcutter's hut outside at (22, 10) and a tree
   * at (25, 12). With `gate`, the ring's tile (16, 12) is a Gate; otherwise it is a Wall.
   */
  function walledCamp(gate: boolean): { world: World; hut: MapObject } {
    const world = new World(flatMap(), new Economy(resources(100, 100, 5)));
    world.spawn(ObjectKind.Keep, 10, 10);
    world.spawn(ObjectKind.Tree, 25, 12);
    const hut = place(world, ObjectKind.WoodcutterHut, 22, 10);
    wall(world, 7, 7, 16, 7);
    wall(world, 7, 16, 16, 16);
    wall(world, 7, 8, 7, 15);
    wall(world, 16, 8, 16, 11);
    wall(world, 16, 13, 16, 15);
    place(world, gate ? ObjectKind.Gate : ObjectKind.Wall, 16, 12);
    return { world, hut };
  }

  it('walks through the gate of a walled Keep to work and delivers the wood', () => {
    const { world, hut } = walledCamp(true);
    const before = world.economy.amount(ResourceKind.Wood);
    tickUntil(world, () => world.economy.amount(ResourceKind.Wood) > before);
    expect(world.economy.amount(ResourceKind.Wood)).toBe(before + 2);
    expect(first(world)?.workplaceId).toBe(hut.id);
  });

  it('reports workerCannotReach when the ring has no gate', () => {
    const { world, hut } = walledCamp(false);
    tickUntil(world, () => world.productionState(hut.id)?.status === 'workerCannotReach', 200);
    expect(first(world)).toBeUndefined(); // no worker is spawned for a hut it cannot reach
  });

  it('never crosses a diagonal wall run, going around its end instead', () => {
    const world = new World(flatMap(), new Economy(resources(100, 40, 5)));
    world.spawn(ObjectKind.Keep, 2, 2);
    world.spawn(ObjectKind.Tree, 24, 22);
    const hut = place(world, ObjectKind.WoodcutterHut, 20, 20);
    wall(world, 4, 20, 20, 4); // the tiles with tx + ty = 24, tx in 4..20
    const side = (tx: number, ty: number): number => Math.sign(tx + ty - 24);
    const visited: TileCoord[] = [];
    tickUntil(world, () => {
      const p = first(world);
      if (p && (visited.length === 0 || visited[visited.length - 1].tx !== p.tx || visited[visited.length - 1].ty !== p.ty)) {
        visited.push(at(p.tx, p.ty));
      }
      return p?.state === 'working';
    });
    expect(first(world)?.workplaceId).toBe(hut.id);
    for (const t of visited) expect(world.objectAt(t.tx, t.ty)?.kind).not.toBe(ObjectKind.Wall);
    for (let i = 1; i < visited.length; i++) {
      const [a, b] = [visited[i - 1], visited[i]];
      expect(side(a.tx, a.ty) * side(b.tx, b.ty), `step ${a.tx},${a.ty} -> ${b.tx},${b.ty}`).not.toBe(-1);
    }
    expect(visited.some((t) => t.tx + t.ty === 24 && (t.tx < 4 || t.tx > 20))).toBe(true);
  });
});

describe('wall determinism', () => {
  it('gives equal checksums for two worlds given the same wall lines on the same ticks', () => {
    const lines: Record<number, WorldCommand> = {
      0: line(7, 7, 16, 9),
      120: line(5, 20, 18, 3),
      300: line(30, 30, -5, 18),
    };
    const run = (): number => {
      const world = new World(flatMap(), new Economy(resources(100, 100, 10)));
      world.spawn(ObjectKind.Keep, 10, 10);
      world.spawn(ObjectKind.Tree, 25, 12);
      world.apply({ type: 'placeBuilding', kind: ObjectKind.WoodcutterHut, tx: 22, ty: 10 });
      for (let t = 0; t < 500; t++) {
        if (lines[t]) {
          const result = world.apply(lines[t]);
          const placed = result.ok && 'placed' in result ? result.placed : 0;
          expect(placed, `line on tick ${t}`).toBeGreaterThan(0);
        }
        world.tick();
      }
      return worldChecksum(world);
    };
    expect(run()).toBe(run());
  });
});
