import { describe, expect, it } from 'vitest';
import { hash2, mulberry32 } from '../src/sim/rng';

describe('mulberry32', () => {
  it('is repeatable for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('differs between seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('returns values in [0, 1) with a mean near 0.5', () => {
    const next = mulberry32(12345);
    let sum = 0;
    for (let i = 0; i < 10000; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    const mean = sum / 10000;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});

describe('hash2', () => {
  it('is a pure function of its inputs', () => {
    expect(hash2(7, 3, 5)).toBe(hash2(7, 3, 5));
  });

  it('depends on coordinate order and seed', () => {
    expect(hash2(7, 3, 5)).not.toBe(hash2(7, 5, 3));
    expect(hash2(7, 3, 5)).not.toBe(hash2(8, 3, 5));
  });

  it('handles negative coordinates', () => {
    const v = hash2(7, -3, -5);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});
