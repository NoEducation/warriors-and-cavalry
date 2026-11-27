import { describe, expect, it } from 'vitest';
import { MIST_CONFIG, mistBanks } from '../src/render/mistBanks';
import { GameMap } from '../src/sim/GameMap';
import { TileType } from '../src/sim/tiles';

/** A size x size map whose tiles are Rock where `rock(tx, ty)` holds and Grass elsewhere, all at height `h`. */
function mapOf(size: number, h: number, rock: (tx: number, ty: number) => boolean, seed = 3): GameMap {
  const heights = new Float32Array((size + 1) * (size + 1)).fill(h);
  const tiles = new Uint8Array(size * size);
  for (let ty = 0; ty < size; ty++) {
    for (let tx = 0; tx < size; tx++) tiles[ty * size + tx] = rock(tx, ty) ? TileType.Rock : TileType.Grass;
  }
  return new GameMap(size, size, seed, heights, tiles);
}

describe('mistBanks', () => {
  it('is a pure function of the map', () => {
    const map = mapOf(64, 8, () => true);
    expect(mistBanks(map)).toEqual(mistBanks(map));
  });

  it('puts no mist over lowland grass', () => {
    expect(mistBanks(mapOf(64, 2, () => false))).toHaveLength(0);
  });

  it('fills mountains with mist banks, only over rock, floating above the ground', () => {
    const map = mapOf(64, 8, (tx) => tx >= 32);
    const banks = mistBanks(map);
    expect(banks.length).toBeGreaterThan(10);
    for (const bank of banks) {
      expect(map.tileAt(Math.floor(bank.x), Math.floor(bank.z))).toBe(TileType.Rock);
      expect(bank.y).toBeGreaterThan(8);
      expect(bank.radius).toBeGreaterThanOrEqual(MIST_CONFIG.radius[0]);
      expect(bank.radius).toBeLessThanOrEqual(MIST_CONFIG.radius[1]);
    }
  });

  it('places banks differently for different seeds', () => {
    const a = mistBanks(mapOf(64, 8, () => true, 1));
    const b = mistBanks(mapOf(64, 8, () => true, 2));
    expect(a).not.toEqual(b);
  });
});
