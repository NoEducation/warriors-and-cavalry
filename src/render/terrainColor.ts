// Terrain vertex colours: per-corner shades of grass, rock, snow and quarry ground from height, slope, curvature and seed
// noise; beach and seabed colours come from shoreColor, and Sand and Grass corners mix by its beach-to-grass blend.
// Render-only and pure: the same map always gets the same colours.
import * as THREE from 'three';
import type { GameMap } from '../sim/GameMap';
import { MAPGEN_CONFIG } from '../sim/MapGenerator';
import { fbm2 } from '../sim/noise';
import { TileType } from '../sim/tiles';
import { beachGrassBlend, sandColor, seabedColor } from './shoreColor';

/** Colour tuning for the terrain, in sRGB hex colours and world units. Tune by editing these values. */
export const TERRAIN_LOOK_CONFIG = Object.freeze({
  grassLush: 0x3c7a2c,
  grassMeadow: 0x5e9c3a,
  grassDry: 0x93a24c,
  grassHighland: 0x6f8a4e,
  rockMoss: 0x737d5e,
  rockStone: 0x7f7a72,
  rockCliff: 0x4e4339,
  snow: 0xd8dee6,
  /** Quarry ground: pale cut limestone, warming to ochre in patches. */
  quarryPale: 0xdccfab,
  quarryOchre: 0xc9a66e,
  /** Noise frequency per tile of the large grass patches, of the dry spots, and of the fine mottling. */
  patchScale: 1 / 28,
  dryScale: 1 / 17,
  detailScale: 1 / 5,
  /** Brightness swing of the fine mottling. */
  detailWeight: 0.14,
  /** Slope (height change per tile) where rock starts to turn to cliff, and where it is fully cliff. */
  cliffSlope: [0.55, 1.7],
  /** Height above which flat rock turns to snow; noise moves the line by up to snowJitter. */
  snowLine: 11.8,
  snowJitter: 0.9,
  snowMaxSlope: 1.5,
  /** Fine noise that frays the snow edge into patches: its frequency per tile and how far it moves the line. */
  snowPatchScale: 1 / 3,
  snowPatchJitter: 0.5,
  /** Dark lichen and weathering patches on rock: noise frequency per tile and how far they darken towards cliff. */
  lichenScale: 1 / 7,
  lichenWeight: 0.4,
  /** Height between strata bands of rock, and their brightness swing. */
  strataSpacing: 0.55,
  strataWeight: 0.11,
  /** How much a corner's height below its neighbours' mean darkens it (and above lightens it), and the limits. */
  curvatureWeight: 0.35,
  curvatureRange: [0.72, 1.15],
});

const SALT = Object.freeze({ patch: 0x51a7, dry: 0x2d33, detail: 0x7e11, snow: 0x4b0b });

const c = TERRAIN_LOOK_CONFIG;
const tmp = new THREE.Color();
const sand = new THREE.Color();

/**
 * Writes into `out` the colour of corner (cx, cy) as part of a tile of `type`, and returns `out`. Corners shared by
 * tiles of different types get one colour per type, so type borders stay crisp. Pure; call once per terrain vertex.
 */
export function terrainVertexColor(map: GameMap, type: TileType, cx: number, cy: number, out: THREE.Color): THREE.Color {
  const h = map.heightAt(cx, cy);
  const n = (salt: number, scale: number, octaves: number): number =>
    fbm2((map.seed ^ salt) | 0, cx * scale, cy * scale, octaves);
  const detail = 1 + c.detailWeight * 2 * (n(SALT.detail, c.detailScale, 2) - 0.5);

  switch (type) {
    case TileType.Grass:
    case TileType.Sand: {
      const blend = beachGrassBlend(map, cx, cy);
      if (blend > 0) grassColor(map, cx, cy, h, n, out);
      if (blend < 1) sandColor(map, cx, cy, blend > 0 ? sand : out);
      if (blend > 0 && blend < 1) out.lerp(sand, 1 - blend);
      break;
    }
    case TileType.Rock: {
      const slope = slopeAt(map, cx, cy);
      out.set(c.rockMoss).lerp(tmp.set(c.rockStone), smooth(MAPGEN_CONFIG.rockAltitude - 0.5, c.snowLine - 1, h));
      out.lerp(tmp.set(c.rockCliff), smooth(c.cliffSlope[0], c.cliffSlope[1], slope));
      out.lerp(tmp.set(c.rockCliff), c.lichenWeight * smooth(0.55, 0.72, n(SALT.dry, c.lichenScale, 2)));
      out.multiplyScalar(1 + c.strataWeight * Math.sin((h / c.strataSpacing) * Math.PI * 2 + 3 * n(SALT.patch, c.patchScale, 1)));
      const coarse = n(SALT.snow, c.patchScale, 2) - 0.5;
      const fine = n(SALT.snow, c.snowPatchScale, 2) - 0.5;
      const snowLine = c.snowLine + 2 * c.snowJitter * coarse + 2 * c.snowPatchJitter * fine;
      const snow = smooth(snowLine - 0.08, snowLine + 0.12, h) * (1 - smooth(c.snowMaxSlope * 0.6, c.snowMaxSlope, slope));
      out.lerp(tmp.set(c.snow), snow);
      break;
    }
    case TileType.Quarry:
      out.set(c.quarryPale).lerp(tmp.set(c.quarryOchre), 0.7 * smooth(0.4, 0.7, n(SALT.dry, c.lichenScale, 2)));
      break;
    default:
      seabedColor(map, cx, cy, out);
  }
  return out.multiplyScalar(detail * curvatureShade(map, cx, cy, h));
}

type Noise = (salt: number, scale: number, octaves: number) => number;

/** Writes into `out` the grass colour of corner (cx, cy) at height `h`: lush and meadow patches, dry spots, highland tint. */
function grassColor(map: GameMap, cx: number, cy: number, h: number, n: Noise, out: THREE.Color): void {
  out.set(c.grassLush).lerp(tmp.set(c.grassMeadow), smooth(0.32, 0.62, n(SALT.patch, c.patchScale, 3)));
  out.lerp(tmp.set(c.grassDry), 0.75 * smooth(0.58, 0.78, n(SALT.dry, c.dryScale, 2)));
  const altitude = (h - MAPGEN_CONFIG.sandBand) / (MAPGEN_CONFIG.rockAltitude - MAPGEN_CONFIG.sandBand);
  out.lerp(tmp.set(c.grassHighland), 0.6 * clamp01(altitude));
}

/** Steepness at a corner: the height gradient's length from its neighbours (clamped at the map edge). */
function slopeAt(map: GameMap, cx: number, cy: number): number {
  const dx = (heightNear(map, cx + 1, cy) - heightNear(map, cx - 1, cy)) / 2;
  const dy = (heightNear(map, cx, cy + 1) - heightNear(map, cx, cy - 1)) / 2;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Below 1 in hollows (corner lower than its neighbours' mean), above 1 on ridges: a cheap ambient occlusion. */
function curvatureShade(map: GameMap, cx: number, cy: number, h: number): number {
  const mean =
    (heightNear(map, cx - 1, cy) + heightNear(map, cx + 1, cy) + heightNear(map, cx, cy - 1) + heightNear(map, cx, cy + 1)) /
    4;
  return Math.min(c.curvatureRange[1], Math.max(c.curvatureRange[0], 1 - c.curvatureWeight * (mean - h)));
}

function heightNear(map: GameMap, cx: number, cy: number): number {
  return map.heightAt(Math.min(map.width, Math.max(0, cx)), Math.min(map.height, Math.max(0, cy)));
}

function smooth(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
