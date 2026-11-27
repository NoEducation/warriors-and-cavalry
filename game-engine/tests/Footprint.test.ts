import { describe, expect, it } from 'vitest';
import { Footprint } from '../src/sim/Footprint';
import { GameMap } from '../src/sim/GameMap';
import { ObjectKind } from '../src/sim/ObjectKind';
import { TileType } from '../src/sim/tiles';

const SIZE = 8;

/** A flat SIZE x SIZE grass map at height 0. */
function flatMap(): GameMap {
  const heights = new Float32Array((SIZE + 1) * (SIZE + 1));
  const tiles = new Uint8Array(SIZE * SIZE).fill(TileType.Grass);
  return new GameMap(SIZE, SIZE, 1, heights, tiles);
}

describe('Footprint', () => {
  it('takes its size from the object kind', () => {
    const keep = Footprint.of(ObjectKind.Keep, 1, 2);
    expect([keep.tx, keep.ty, keep.width, keep.height]).toEqual([1, 2, 4, 4]);
  });

  it('lists the tiles of a 2x2 footprint in row-major order', () => {
    expect(Array.from(Footprint.of(ObjectKind.Hovel, 3, 4).tiles())).toEqual([
      { tx: 3, ty: 4 },
      { tx: 4, ty: 4 },
      { tx: 3, ty: 5 },
      { tx: 4, ty: 5 },
    ]);
  });

  it('is in bounds only when every tile is inside the map and the anchor is integer', () => {
    const map = flatMap();
    expect(Footprint.of(ObjectKind.Hovel, 0, 0).inBounds(map)).toBe(true);
    expect(Footprint.of(ObjectKind.Hovel, SIZE - 2, SIZE - 2).inBounds(map)).toBe(true);
    expect(Footprint.of(ObjectKind.Hovel, -1, 3).inBounds(map), 'left').toBe(false);
    expect(Footprint.of(ObjectKind.Hovel, 3, -1).inBounds(map), 'top').toBe(false);
    expect(Footprint.of(ObjectKind.Hovel, SIZE - 1, 3).inBounds(map), 'right').toBe(false);
    expect(Footprint.of(ObjectKind.Hovel, 3, SIZE - 1).inBounds(map), 'bottom').toBe(false);
    expect(Footprint.of(ObjectKind.Hovel, 1.5, 3).inBounds(map), 'non-integer tx').toBe(false);
    expect(Footprint.of(ObjectKind.Hovel, 3, 0.5).inBounds(map), 'non-integer ty').toBe(false);
  });

  it('gives the lowest and highest corner height', () => {
    const map = flatMap();
    map.heights[5 * (SIZE + 1) + 4] = 0.7; // corner (4, 5)
    expect(Footprint.of(ObjectKind.Hovel, 3, 4).cornerHeightRange(map)).toEqual({ min: 0, max: expect.closeTo(0.7) });
    expect(Footprint.of(ObjectKind.Hovel, 0, 0).cornerHeightRange(map)).toEqual({ min: 0, max: 0 });
  });

  it('lists the edge neighbours of a 2x2 footprint in row-major order, without diagonal corners', () => {
    expect(Array.from(new Footprint(3, 4, 2, 2).edgeNeighbours())).toEqual([
      { tx: 3, ty: 3 },
      { tx: 4, ty: 3 },
      { tx: 2, ty: 4 },
      { tx: 5, ty: 4 },
      { tx: 2, ty: 5 },
      { tx: 5, ty: 5 },
      { tx: 3, ty: 6 },
      { tx: 4, ty: 6 },
    ]);
  });

  it('skips corners outside the map and returns null when none are inside', () => {
    const map = flatMap();
    map.heights[0] = 2; // corner (0, 0)
    expect(Footprint.of(ObjectKind.Hovel, -1, -1).cornerHeightRange(map)).toEqual({ min: 0, max: 2 });
    expect(Footprint.of(ObjectKind.Hovel, -5, -5).cornerHeightRange(map)).toBeNull();
    expect(Footprint.of(ObjectKind.Hovel, SIZE + 1, 0).cornerHeightRange(map)).toBeNull();
  });
});
