// How each tree looks: species, size, turn, lean and tint, derived from the map seed, the tile and its altitude.
// Render-only: the simulation knows only "a tree stands here", so these looks never affect the world or its checksum.
import type { GameMap } from '../sim/GameMap';
import { MAPGEN_CONFIG } from '../sim/MapGenerator';
import { fbm2 } from '../sim/noise';
import { hash2 } from '../sim/rng';
import { TreeSpecies } from './TreeSpecies';

/** Per-tree variation tuning. Tree looks are a pure function of seed, tile and terrain; tune by editing these values. */
export const TREE_APPEARANCE_CONFIG = Object.freeze({
  /** Altitudes where grass (and so trees) starts above the beach and where rock takes over. */
  lowAltitude: MAPGEN_CONFIG.seaLevel + MAPGEN_CONFIG.sandBand,
  highAltitude: MAPGEN_CONFIG.rockAltitude,
  /** Species patch noise frequency per tile and octaves; low frequency so stands of one species form. */
  patchScale: 1 / 20,
  patchOctaves: 2,
  /** How far (in altitude fractions) the patch noise and the per-tile hash shift a tree towards another zone. */
  patchWeight: 0.35,
  jitterWeight: 0.12,
  /** On the 0..1 altitude-plus-noise score: birches below the first, pines above the second, oaks in between. */
  birchBelow: 0.3,
  pineAbove: 0.6,
  deadShare: 0.02,
  heightRange: [0.7, 1.3],
  widthRange: [0.8, 1.2],
  tintRange: [0.85, 1.15],
  maxLeanRad: (6 * Math.PI) / 180,
});

/** Mixed into the map seed, one per property, so each property varies independently of the others. */
const SALT = Object.freeze({
  patch: 0x3c1f,
  jitter: 0x1b873593,
  dead: 0x68e31da4,
  height: 0x2545f491,
  width: 0x5f356495,
  rotation: 0x5bd1e995,
  leanDirection: 0x7feb352d,
  leanAmount: 0x846ca68b,
  tint: 0x4f1bbcdc,
});

/** The look of one tree, applied on top of its species' base shape. Angles in radians. */
export interface TreeAppearance {
  readonly species: TreeSpecies;
  /** Multiplies the species' base height, in [0.7, 1.3]. */
  readonly heightScale: number;
  /** Multiplies the species' base width, in [0.8, 1.2]. */
  readonly widthScale: number;
  /** Turn around the vertical axis, in [0, 2π). */
  readonly rotation: number;
  /** Tilt around the world x and z axes; together at most about 6°. */
  readonly leanX: number;
  readonly leanZ: number;
  /** Brightness multiplier for the whole tree, in [0.85, 1.15]. */
  readonly tint: number;
}

/** The look of the tree on tile (tx, ty) of `map`. Pure: the same map and tile always give the same look. */
export function treeAppearance(map: GameMap, tx: number, ty: number): TreeAppearance {
  const c = TREE_APPEARANCE_CONFIG;
  const h = (salt: number): number => hash2((map.seed ^ salt) | 0, tx, ty);
  const leanDirection = h(SALT.leanDirection) * 2 * Math.PI;
  const lean = h(SALT.leanAmount) * c.maxLeanRad;
  return {
    species: chooseSpecies(map, tx, ty, h),
    heightScale: lerp(c.heightRange, h(SALT.height)),
    widthScale: lerp(c.widthRange, h(SALT.width)),
    rotation: h(SALT.rotation) * 2 * Math.PI,
    leanX: lean * Math.cos(leanDirection),
    leanZ: lean * Math.sin(leanDirection),
    tint: lerp(c.tintRange, h(SALT.tint)),
  };
}

/** Pines on high ground, birches on low ground, oaks between; patch noise blends the zones; a few trees are dead. */
function chooseSpecies(map: GameMap, tx: number, ty: number, h: (salt: number) => number): TreeSpecies {
  const c = TREE_APPEARANCE_CONFIG;
  if (h(SALT.dead) < c.deadShare) return TreeSpecies.Dead;
  const altitude = (map.tileHeight(tx, ty) - c.lowAltitude) / (c.highAltitude - c.lowAltitude);
  const patch = fbm2((map.seed + SALT.patch) | 0, tx * c.patchScale, ty * c.patchScale, c.patchOctaves);
  const score = altitude + c.patchWeight * 2 * (patch - 0.5) + c.jitterWeight * 2 * (h(SALT.jitter) - 0.5);
  if (score < c.birchBelow) return TreeSpecies.Birch;
  if (score > c.pineAbove) return TreeSpecies.Pine;
  return TreeSpecies.Oak;
}

/** The value at fraction `t` of the way from range[0] to range[1]. */
function lerp(range: readonly number[], t: number): number {
  return range[0] + (range[1] - range[0]) * t;
}
