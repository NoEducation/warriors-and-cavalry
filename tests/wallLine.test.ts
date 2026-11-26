import { describe, expect, it } from 'vitest';
import type { TileCoord } from '../src/sim/TileCoord';
import { WALL_LINE_MAX_TILES, wallLineTiles } from '../src/sim/wallLine';

const at = (tx: number, ty: number): TileCoord => ({ tx, ty });

describe('wallLineTiles', () => {
  it('walks a horizontal line from end to end', () => {
    const tiles = wallLineTiles(at(0, 0), at(4, 0));
    expect(tiles).toHaveLength(5);
    expect(tiles.every((t) => t.ty === 0)).toBe(true);
    expect(tiles.map((t) => t.tx)).toEqual([0, 1, 2, 3, 4]);
  });

  it('walks a vertical line towards negative y', () => {
    expect(wallLineTiles(at(0, 0), at(0, -3))).toEqual([at(0, 0), at(0, -1), at(0, -2), at(0, -3)]);
  });

  it('steps diagonally on a 45 degree line', () => {
    expect(wallLineTiles(at(0, 0), at(3, 3))).toEqual([at(0, 0), at(1, 1), at(2, 2), at(3, 3)]);
  });

  it('gives neighbouring tiles without repeats on a shallow slope', () => {
    const tiles = wallLineTiles(at(0, 0), at(5, 2));
    expect(tiles).toHaveLength(6);
    expect(tiles[0]).toEqual(at(0, 0));
    expect(tiles[tiles.length - 1]).toEqual(at(5, 2));
    for (let i = 1; i < tiles.length; i++) {
      const step = Math.max(Math.abs(tiles[i].tx - tiles[i - 1].tx), Math.abs(tiles[i].ty - tiles[i - 1].ty));
      expect(step).toBe(1);
    }
    expect(new Set(tiles.map((t) => `${t.tx},${t.ty}`)).size).toBe(tiles.length);
  });

  it('gives one tile when from equals to', () => {
    expect(wallLineTiles(at(2, 2), at(2, 2))).toEqual([at(2, 2)]);
  });

  it(`cuts a long line to its first ${WALL_LINE_MAX_TILES} tiles from the start`, () => {
    expect(WALL_LINE_MAX_TILES).toBe(64);
    const tiles = wallLineTiles(at(0, 0), at(100, 0));
    expect(tiles).toHaveLength(64);
    expect(tiles[0]).toEqual(at(0, 0));
    expect(tiles[63]).toEqual(at(63, 0));
  });

  it('gives the same tiles for the same inputs', () => {
    expect(wallLineTiles(at(-4, 7), at(9, -2))).toEqual(wallLineTiles(at(-4, 7), at(9, -2)));
  });
});
