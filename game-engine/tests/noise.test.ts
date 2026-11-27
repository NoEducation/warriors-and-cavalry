import { describe, expect, it } from 'vitest';
import { fbm2, valueNoise2 } from '../src/sim/noise';
import { hash2 } from '../src/sim/rng';

const SEED = 99;

function forGrid(fn: (x: number, y: number) => void): void {
  for (let i = 0; i < 50; i++) {
    for (let j = 0; j < 50; j++) {
      fn(i * 0.37, j * 0.37);
    }
  }
}

describe('valueNoise2', () => {
  it('equals hash2 at integer coordinates', () => {
    for (let x = -3; x <= 3; x++) {
      for (let y = -3; y <= 3; y++) {
        expect(valueNoise2(SEED, x, y)).toBe(hash2(SEED, x, y));
      }
    }
  });

  it('stays in [0, 1) over a grid', () => {
    forGrid((x, y) => {
      const v = valueNoise2(SEED, x, y);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    });
  });

  it('is continuous', () => {
    for (let k = 0; k < 100; k++) {
      const x = k * 0.173;
      const y = k * 0.291;
      const d = Math.abs(valueNoise2(SEED, x, y) - valueNoise2(SEED, x + 0.001, y));
      expect(d).toBeLessThan(0.01);
    }
  });
});

describe('fbm2', () => {
  it('is repeatable', () => {
    expect(fbm2(SEED, 1.3, 2.7, 4)).toBe(fbm2(SEED, 1.3, 2.7, 4));
  });

  it('stays in [0, 1) over a grid', () => {
    forGrid((x, y) => {
      const v = fbm2(SEED, x, y, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    });
  });

  it('with one octave equals valueNoise2', () => {
    forGrid((x, y) => {
      expect(fbm2(SEED, x, y, 1)).toBe(valueNoise2(SEED, x, y));
    });
  });
});
