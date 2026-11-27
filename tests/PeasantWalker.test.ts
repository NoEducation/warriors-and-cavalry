import { describe, expect, it } from 'vitest';
import { Peasant } from '../src/sim/Peasant';
import { PeasantWalker } from '../src/sim/PeasantWalker';
import type { TileCoord } from '../src/sim/TileCoord';
import { WalkClass } from '../src/sim/walkRules';

const SIZE = 16;

/** A walker on an open 16 x 16 map whose `blocked` tiles are not walkable, and a peasant standing on (0, 4). */
function setup(): { walker: PeasantWalker; blocked: Set<number>; peasant: Peasant } {
  const blocked = new Set<number>();
  const walkClass = (tx: number, ty: number): WalkClass =>
    tx >= 0 && ty >= 0 && tx < SIZE && ty < SIZE && !blocked.has(ty * SIZE + tx) ? WalkClass.Ground : WalkClass.Blocked;
  return { walker: new PeasantWalker(SIZE, SIZE, walkClass), blocked, peasant: new Peasant(1, 0, 4, 0) };
}

function ticks(walker: PeasantWalker, peasant: Peasant, n: number): void {
  for (let i = 0; i < n; i++) walker.tick(peasant);
}

/** Ticks until the peasant stands on `goal` (at most 200 ticks); returns the ticks taken and every tile entered. */
function walk(walker: PeasantWalker, p: Peasant, goal: TileCoord): { ticksTaken: number; entered: TileCoord[] } {
  const entered: TileCoord[] = [];
  for (let n = 1; n <= 200; n++) {
    const from = { tx: p.tx, ty: p.ty };
    walker.tick(p);
    if (p.tx !== from.tx || p.ty !== from.ty) entered.push({ tx: p.tx, ty: p.ty });
    if (p.tx === goal.tx && p.ty === goal.ty) {
      expect(p).toMatchObject({ nextTx: goal.tx, nextTy: goal.ty, stepProgress: 0, stepTicks: 0 });
      return { ticksTaken: n, entered };
    }
  }
  throw new Error('walk did not end');
}

describe('PeasantWalker', () => {
  it('takes 4 ticks per straight step, counting stepProgress up within a step', () => {
    const { walker, peasant } = setup();
    expect(walker.walkTo(peasant, [{ tx: 3, ty: 4 }])).toBe(true);
    walker.tick(peasant);
    expect(peasant).toMatchObject({ tx: 0, ty: 4, nextTx: 1, nextTy: 4, stepProgress: 1, stepTicks: 4 });
    ticks(walker, peasant, 2);
    expect(peasant).toMatchObject({ tx: 0, stepProgress: 3 });
    walker.tick(peasant);
    expect(peasant).toMatchObject({ tx: 1, ty: 4, stepProgress: 0 });
    const { ticksTaken } = walk(walker, peasant, { tx: 3, ty: 4 });
    expect(4 + ticksTaken).toBe(12);
    ticks(walker, peasant, 10);
    expect(peasant).toMatchObject({ tx: 3, ty: 4, nextTx: 3, nextTy: 4, stepTicks: 0 });
  });

  it('takes 6 ticks per diagonal step', () => {
    const { walker, peasant } = setup();
    walker.walkTo(peasant, [{ tx: 2, ty: 6 }]);
    walker.tick(peasant);
    expect(peasant).toMatchObject({ nextTx: 1, nextTy: 5, stepTicks: 6 });
    const { ticksTaken } = walk(walker, peasant, { tx: 2, ty: 6 });
    expect(1 + ticksTaken).toBe(12);
  });

  it('does not step onto a tile built over after the search, and says so; searching again is the caller\'s job', () => {
    const { walker, blocked, peasant } = setup();
    walker.walkTo(peasant, [{ tx: 6, ty: 4 }]);
    walker.tick(peasant); // stepping onto (1, 4); (2, 4) is next
    blocked.add(4 * SIZE + 2);
    ticks(walker, peasant, 3);
    expect(peasant).toMatchObject({ tx: 1, ty: 4, stepTicks: 0 });
    expect(walker.isNextStepBlocked(peasant)).toBe(true);
    ticks(walker, peasant, 10);
    expect(peasant).toMatchObject({ tx: 1, ty: 4, stepTicks: 0 });
    expect(walker.walkTo(peasant, [{ tx: 6, ty: 4 }])).toBe(true);
    expect(walker.isNextStepBlocked(peasant)).toBe(false);
    const { entered } = walk(walker, peasant, { tx: 6, ty: 4 });
    expect(entered).not.toContainEqual({ tx: 2, ty: 4 });
  });

  it('walks off a tile that became covered by a building', () => {
    const { walker, blocked, peasant } = setup();
    blocked.add(4 * SIZE + 0);
    expect(walker.walkTo(peasant, [{ tx: 3, ty: 4 }])).toBe(true);
    const { ticksTaken } = walk(walker, peasant, { tx: 3, ty: 4 });
    expect(ticksTaken).toBe(12);
  });

  it('reports false and stays put when no goal is reachable', () => {
    const { walker, blocked, peasant } = setup();
    for (const [tx, ty] of [[0, 1], [1, 1], [2, 1], [2, 0]]) blocked.add(ty * SIZE + tx);
    expect(walker.walkTo(peasant, [{ tx: 0, ty: 0 }])).toBe(false);
    walker.tick(peasant);
    expect(peasant).toMatchObject({ tx: 0, ty: 4, stepTicks: 0, path: [] });
  });
});
