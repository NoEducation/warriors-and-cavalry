import { describe, expect, it } from 'vitest';
import { MapGenerator } from '../src/sim/MapGenerator';
import { PATH_CONFIG } from '../src/sim/pathConfig';
import { PathFinder, type IsWalkable } from '../src/sim/PathFinder';
import type { TileCoord } from '../src/sim/TileCoord';

/** A width x height grid where every tile except `blocked` ("tx,ty") is walkable. */
function grid(width: number, height: number, blocked: Iterable<string> = []): IsWalkable {
  const set = new Set(blocked);
  return (tx, ty) => tx >= 0 && ty >= 0 && tx < width && ty < height && !set.has(`${tx},${ty}`);
}

const t = (tx: number, ty: number): TileCoord => ({ tx, ty });

/** Asserts every step moves to a walkable neighbour without cutting a corner. */
function expectValidPath(start: TileCoord, path: readonly TileCoord[], isWalkable: IsWalkable): void {
  let prev = start;
  for (const tile of path) {
    const dx = tile.tx - prev.tx;
    const dy = tile.ty - prev.ty;
    expect(Math.max(Math.abs(dx), Math.abs(dy))).toBe(1);
    expect(isWalkable(tile.tx, tile.ty)).toBe(true);
    if (dx !== 0 && dy !== 0) {
      expect(isWalkable(prev.tx + dx, prev.ty)).toBe(true);
      expect(isWalkable(prev.tx, prev.ty + dy)).toBe(true);
    }
    prev = tile;
  }
}

/** All 8 neighbours of (tx, ty) as blocked-set keys. */
function ring(tx: number, ty: number): string[] {
  const keys: string[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) if (dx !== 0 || dy !== 0) keys.push(`${tx + dx},${ty + dy}`);
  }
  return keys;
}

describe('PathFinder', () => {
  it('walks a straight line on an open grid', () => {
    const path = new PathFinder(10, 10).find(t(0, 0), [t(5, 0)], grid(10, 10));
    expect(path).not.toBeNull();
    expect(path!.length).toBe(5);
    expect(path!.every((tile) => tile.ty === 0)).toBe(true);
    expect(path![4]).toEqual(t(5, 0));
  });

  it('walks diagonally on an open grid', () => {
    const path = new PathFinder(10, 10).find(t(0, 0), [t(4, 4)], grid(10, 10));
    expect(path).toEqual([t(1, 1), t(2, 2), t(3, 3), t(4, 4)]);
  });

  it('goes around a wall', () => {
    const wall = Array.from({ length: 9 }, (_, y) => `3,${y}`);
    const isWalkable = grid(10, 10, wall);
    const path = new PathFinder(10, 10).find(t(0, 0), [t(6, 0)], isWalkable);
    expect(path).not.toBeNull();
    expectValidPath(t(0, 0), path!, isWalkable);
    expect(path!.some((tile) => tile.ty === 9)).toBe(true);
    expect(path![path!.length - 1]).toEqual(t(6, 0));
  });

  it('does not cut corners', () => {
    const finder = new PathFinder(10, 10);
    expect(finder.find(t(0, 0), [t(1, 1)], grid(10, 10, ['1,0', '0,1']))).toBeNull();
    const isWalkable = grid(10, 10, ['1,0']);
    const path = finder.find(t(0, 0), [t(1, 1)], isWalkable);
    expect(path).toEqual([t(0, 1), t(1, 1)]);
    expectValidPath(t(0, 0), path!, isWalkable);
  });

  it('returns null for a goal walled off on all 8 sides', () => {
    expect(new PathFinder(10, 10).find(t(0, 0), [t(5, 5)], grid(10, 10, ring(5, 5)))).toBeNull();
  });

  it('returns [] when the start is a goal and null for no goals', () => {
    const finder = new PathFinder(10, 10);
    expect(finder.find(t(2, 2), [t(7, 7), t(2, 2)], grid(10, 10))).toEqual([]);
    expect(finder.find(t(2, 2), [], grid(10, 10))).toBeNull();
  });

  it('leaves an unwalkable start tile', () => {
    const isWalkable = grid(10, 10, ['2,2']);
    const path = new PathFinder(10, 10).find(t(2, 2), [t(5, 2)], isWalkable);
    expect(path).toEqual([t(3, 2), t(4, 2), t(5, 2)]);
  });

  it('ends on the nearest of several goals', () => {
    const path = new PathFinder(10, 10).find(t(0, 0), [t(9, 0), t(2, 2)], grid(10, 10));
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual(t(2, 2));
  });

  it('gives the same path for the same inputs', () => {
    const wall = Array.from({ length: 9 }, (_, y) => `3,${y}`);
    const finder = new PathFinder(10, 10);
    const a = finder.find(t(0, 0), [t(6, 0), t(9, 9)], grid(10, 10, wall));
    const b = finder.find(t(0, 0), [t(6, 0), t(9, 9)], grid(10, 10, wall));
    expect(a).not.toBeNull();
    expect(b).toEqual(a);
    expect(new PathFinder(10, 10).find(t(0, 0), [t(6, 0), t(9, 9)], grid(10, 10, wall))).toEqual(a);
  });

  it('gives up after the expansion limit', () => {
    const finder = new PathFinder(300, 300);
    const started = performance.now();
    const path = finder.find(t(0, 0), [t(299, 299)], grid(300, 300, ring(299, 299)));
    const elapsed = performance.now() - started;
    expect(path).toBeNull();
    expect(finder.lastExpanded).toBeLessThanOrEqual(PATH_CONFIG.maxExpanded);
    expect(finder.lastExpanded).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000);
  });

});

describe('PathFinder on a generated 512 x 512 world', () => {
  const world = new MapGenerator().generate({ seed: 1, width: 512, height: 512 });
  const isWalkable = (tx: number, ty: number): boolean => world.isWalkable(tx, ty);
  /** The first walkable tile in row `ty`, starting at `from` and stepping by `step`. */
  const firstWalkable = (from: number, step: number, ty: number): TileCoord => {
    let tx = from;
    while (!isWalkable(tx, ty)) tx += step;
    return t(tx, ty);
  };

  it('expands few tiles beyond the path on a diagonal route', () => {
    const start = firstWalkable(130, 1, 180);
    const goal = firstWalkable(400, -1, 330);
    const finder = new PathFinder(512, 512);
    const started = performance.now();
    const path = finder.find(start, [goal], isWalkable);
    const elapsed = performance.now() - started;
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(250);
    expectValidPath(start, path!, isWalkable);
    expect(path![path!.length - 1]).toEqual(goal);
    expect(finder.lastExpanded).toBeLessThanOrEqual(3 * path!.length);
    expect(elapsed).toBeLessThan(200);
  });

  it('finds a ~300-tile straight path quickly', () => {
    const start = firstWalkable(106, 1, 256);
    const goal = firstWalkable(406, -1, 256);
    expect(goal.tx - start.tx).toBeGreaterThan(250);
    const finder = new PathFinder(512, 512);
    finder.find(start, [goal], isWalkable); // warm-up: the first run includes JIT compilation
    // Best of 5, so a GC pause or a busy CPU (the suite runs files in parallel) does not decide the result.
    let path: TileCoord[] | null = null;
    let elapsed = Infinity;
    for (let run = 0; run < 5; run++) {
      const started = performance.now();
      path = finder.find(start, [goal], isWalkable);
      elapsed = Math.min(elapsed, performance.now() - started);
    }
    expect(path).not.toBeNull();
    expectValidPath(start, path!, isWalkable);
    expect(elapsed).toBeLessThan(20);
  });
});
