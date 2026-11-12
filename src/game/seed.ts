// Map seed from the URL query string, or a fresh random one. No three.js here (unit-tested in Node).

export const DEFAULT_SEED = 1;

const MAX_SEED = 4294967295;

/** The `seed` query parameter if it is a plain base-10 integer in 0..2^32-1, otherwise DEFAULT_SEED. */
export function parseSeed(search: string): number {
  const raw = new URLSearchParams(search).get('seed');
  if (raw === null || !/^[0-9]+$/.test(raw)) return DEFAULT_SEED;
  const seed = Number(raw);
  return seed <= MAX_SEED ? seed : DEFAULT_SEED;
}

/** A uniformly random seed in 0..2^32-1. */
export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
