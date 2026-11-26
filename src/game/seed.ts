// Map seed from the URL query string, or a fresh random one. No three.js here (unit-tested in Node).
import { GAME_CONFIG } from './GameConfig';

const MAX_SEED = 4294967295;

/** The `seed` query parameter if it is a plain base-10 integer in 0..2^32-1, otherwise `GAME_CONFIG.defaultSeed`. */
export function parseSeed(search: string): number {
  const raw = new URLSearchParams(search).get('seed');
  if (raw === null || !/^[0-9]+$/.test(raw)) return GAME_CONFIG.defaultSeed;
  const seed = Number(raw);
  return seed <= MAX_SEED ? seed : GAME_CONFIG.defaultSeed;
}

/** A uniformly random seed in 0..2^32-1. */
export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
