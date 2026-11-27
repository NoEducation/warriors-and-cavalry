import { describe, expect, it } from 'vitest';
import { groundHeightAt } from '../src/render/groundHeightAt';
import { GameMap } from '../src/sim/GameMap';

/** A 4 x 4 map whose corner height is its x coordinate. */
const map = new GameMap(4, 4, 1, Float32Array.from({ length: 25 }, (_, i) => i % 5), new Uint8Array(16));

describe('groundHeightAt', () => {
  it('gives the mean height of the tile under the position', () => {
    expect(groundHeightAt(map, 2.3, 1.7)).toBeCloseTo(2.5);
  });

  it('uses the nearest edge tile off the map', () => {
    expect(groundHeightAt(map, -3, 2)).toBeCloseTo(0.5);
    expect(groundHeightAt(map, 9, 9)).toBeCloseTo(3.5);
  });
});
