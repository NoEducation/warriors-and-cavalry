// Deterministic pseudo-random sources. Integer math only (Math.imul, shifts).

const TWO_POW_32 = 4294967296;

/** Standard mulberry32 PRNG. Each call returns a float in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / TWO_POW_32;
  };
}

/** Hash of integer lattice point (x, y) under `seed`. Returns a float in [0, 1). */
export function hash2(seed: number, x: number, y: number): number {
  let h = Math.imul(seed | 0, 0x27d4eb2d);
  h ^= Math.imul(x | 0, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= Math.imul(y | 0, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13), 0x297a2d39);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h ^= h >>> 16;
  return (h >>> 0) / TWO_POW_32;
}
