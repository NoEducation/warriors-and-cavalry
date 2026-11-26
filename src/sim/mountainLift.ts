// Ridged mountain relief added on top of the rolling hills: sharp crests and steep faces where the hills are already high.
import { fbm2 } from './noise';

/** Mountain tuning, in world units and per-tile frequencies. Frozen so maps stay reproducible. */
export const MOUNTAIN_CONFIG = Object.freeze({
  /** Hill height where mountains begin to rise, and where they reach full strength. */
  startHeight: 4.4,
  fullHeight: 6.8,
  /** Extra height of a crest at full strength. */
  peakHeight: 8,
  /** Ridge noise frequency per tile, and its octaves. */
  ridgeScale: 1 / 13,
  ridgeOctaves: 3,
  /** Power applied to the ridge shape; higher gives narrower crests and wider valleys between them. */
  sharpness: 2.2,
});

/** Seed offset for the ridge noise, so it differs from the hill and coastline noise. */
const RIDGE_SEED_OFFSET = 0x41d6e;

/**
 * Extra height for corner (cx, cy) whose rolling-hill height is `hill`: zero on low ground, ridged crests on high
 * ground. Pure; call once per corner while generating the terrain.
 */
export function mountainLift(seed: number, cx: number, cy: number, hill: number): number {
  const c = MOUNTAIN_CONFIG;
  const t = Math.min(1, Math.max(0, (hill - c.startHeight) / (c.fullHeight - c.startHeight)));
  if (t === 0) return 0;
  const mask = t * t * (3 - 2 * t);
  const n = fbm2((seed + RIDGE_SEED_OFFSET) | 0, cx * c.ridgeScale, cy * c.ridgeScale, c.ridgeOctaves);
  // 1 on the noise's mid-line, falling to 0 either side: a network of crests.
  const ridge = 1 - Math.abs(2 * n - 1);
  return c.peakHeight * mask * ridge ** c.sharpness;
}
