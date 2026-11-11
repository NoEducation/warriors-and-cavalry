// Deterministic 2D value noise built on hash2.
import { hash2 } from './rng';

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smoothly interpolated lattice noise. Continuous; returns [0, 1). */
export function valueNoise2(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = smoothstep(x - x0);
  const sy = smoothstep(y - y0);
  const top = lerp(hash2(seed, x0, y0), hash2(seed, x0 + 1, y0), sx);
  const bottom = lerp(hash2(seed, x0, y0 + 1), hash2(seed, x0 + 1, y0 + 1), sx);
  return lerp(top, bottom, sy);
}

/**
 * Fractal sum of `octaves` value-noise layers. Each layer doubles the
 * frequency, halves the amplitude and uses seed + octaveIndex. Returns [0, 1).
 */
export function fbm2(seed: number, x: number, y: number, octaves: number): number {
  let sum = 0;
  let amplitudeSum = 0;
  let amplitude = 1;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * valueNoise2(seed + i, x * frequency, y * frequency);
    amplitudeSum += amplitude;
    amplitude /= 2;
    frequency *= 2;
  }
  return sum / amplitudeSum;
}
