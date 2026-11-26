// Beach and seabed colours: dry dunes, pebbles, a tide line and wet sand on the beach; sandy shallows darkening offshore;
// and the noisy height band where the beach fades into grass.
import * as THREE from 'three';
import type { GameMap } from '../sim/GameMap';
import { MAPGEN_CONFIG } from '../sim/MapGenerator';
import { fbm2 } from '../sim/noise';
import { hash2 } from '../sim/rng';

/** Shore colour tuning, in sRGB hex colours and world units above or below sea level. Tune by editing these values. */
export const SHORE_LOOK_CONFIG = Object.freeze({
  sandDry: 0xecdba6,
  sandBleached: 0xf0e4bb,
  sandWet: 0xc0a675,
  pebble: 0x8c7f6c,
  seabedSand: 0xc9b27a,
  seabedDeep: 0x3c5a50,
  /** Height above sea level over which wet sand dries, and the width of the darker tide line just above it. */
  wetBand: 0.14,
  tideBand: 0.07,
  tideDarken: 0.14,
  /** Dune mottling: noise frequency per tile and brightness swing; bleached patches: frequency and strength. */
  duneScale: 1 / 4,
  duneWeight: 0.08,
  bleachScale: 1 / 15,
  bleachWeight: 0.6,
  /** Share of beach corners that show a pebble. */
  pebbleShare: 0.06,
  /** Depth at which the seabed has turned fully deep, and its mottling noise frequency per tile and swing. */
  deepAt: 3.2,
  seabedScale: 1 / 6,
  seabedWeight: 0.12,
  /** Beach-to-grass fade: half its height band around the top of the beach (sea level plus the sand band). */
  grassBlendHalfWidth: 0.15,
  /** Coarse noise that makes the edge wobble along the coast: its frequency per tile and how far it moves the band. */
  edgeScale: 1 / 7,
  edgeJitter: 0.12,
  /** Fine noise that frays the edge into grass tufts on the sand and sandy spots in the grass. */
  tuftScale: 1 / 1.3,
  tuftJitter: 0.05,
});

const SALT = Object.freeze({ dune: 0x3d11, bleach: 0x6a07, pebble: 0x2f9b, seabed: 0x5c21, edge: 0x1e57, tuft: 0x7a3d });
const c = SHORE_LOOK_CONFIG;
const tmp = new THREE.Color();

/** Writes into `out` the colour of beach corner (cx, cy) and returns it. Pure; call once per sand vertex. */
export function sandColor(map: GameMap, cx: number, cy: number, out: THREE.Color): THREE.Color {
  const above = map.heightAt(cx, cy) - MAPGEN_CONFIG.seaLevel;
  const n = (salt: number, scale: number): number => fbm2((map.seed ^ salt) | 0, cx * scale, cy * scale, 2);
  out.set(c.sandDry).lerp(tmp.set(c.sandBleached), c.bleachWeight * smooth(0.55, 0.75, n(SALT.bleach, c.bleachScale)));
  out.multiplyScalar(1 + c.duneWeight * 2 * (n(SALT.dune, c.duneScale) - 0.5));
  if (hash2((map.seed ^ SALT.pebble) | 0, cx, cy) < c.pebbleShare) out.lerp(tmp.set(c.pebble), 0.6);
  const tide = 1 - Math.abs(above - c.wetBand - c.tideBand / 2) / (c.tideBand / 2);
  out.multiplyScalar(1 - c.tideDarken * Math.max(0, tide));
  return out.lerp(tmp.set(c.sandWet), 1 - smooth(0, c.wetBand, above));
}

/**
 * How far corner (cx, cy) has turned from beach (0) to grass (1). It depends only on the corner, so Sand and Grass
 * tiles sharing a corner mix it alike and the beach edge has no seam. Pure; call once per sand or grass vertex.
 */
export function beachGrassBlend(map: GameMap, cx: number, cy: number): number {
  const n = (salt: number, scale: number): number => fbm2((map.seed ^ salt) | 0, cx * scale, cy * scale, 2);
  const mid = MAPGEN_CONFIG.seaLevel + MAPGEN_CONFIG.sandBand;
  const jitter = c.edgeJitter * 2 * (n(SALT.edge, c.edgeScale) - 0.5) + c.tuftJitter * 2 * (n(SALT.tuft, c.tuftScale) - 0.5);
  return smooth(mid - c.grassBlendHalfWidth, mid + c.grassBlendHalfWidth, map.heightAt(cx, cy) + jitter);
}

/** Writes into `out` the colour of seabed corner (cx, cy) and returns it. Pure; call once per underwater vertex. */
export function seabedColor(map: GameMap, cx: number, cy: number, out: THREE.Color): THREE.Color {
  const depth = MAPGEN_CONFIG.seaLevel - map.heightAt(cx, cy);
  const mottle = fbm2((map.seed ^ SALT.seabed) | 0, cx * c.seabedScale, cy * c.seabedScale, 2);
  out.set(c.seabedSand).lerp(tmp.set(c.seabedDeep), smooth(0, c.deepAt, depth));
  return out.multiplyScalar(1 + c.seabedWeight * 2 * (mottle - 0.5));
}

function smooth(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
