// Map seed from the URL query string or typed text, or a fresh random one. No three.js here (unit-tested in Node).
import { GAME_CONFIG } from './GameConfig';

const MAX_SEED = 4294967295;

/** `text` (trimmed) as a seed when it is a plain base-10 integer in 0..2^32-1, otherwise null. */
export function parseSeedText(text: string): number | null {
  const trimmed = text.trim();
  if (!/^[0-9]+$/.test(trimmed)) return null;
  const seed = Number(trimmed);
  return seed <= MAX_SEED ? seed : null;
}

/** The `seed` query parameter if it is a plain base-10 integer in 0..2^32-1, otherwise `GAME_CONFIG.defaultSeed`. */
export function parseSeed(search: string): number {
  const raw = new URLSearchParams(search).get('seed');
  if (raw === null || raw !== raw.trim()) return GAME_CONFIG.defaultSeed;
  return parseSeedText(raw) ?? GAME_CONFIG.defaultSeed;
}

/** A uniformly random seed in 0..2^32-1. */
export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

/** Puts `seed` in the page URL's query string without reloading, so a reload or shared link shows the same map. */
export function writeSeedToUrl(seed: number): void {
  const url = new URL(location.href);
  url.searchParams.set('seed', String(seed));
  history.replaceState(null, '', url);
}
