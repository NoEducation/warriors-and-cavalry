// Deterministic world generator: fbm hills on an island whose coastline wobbles with low-frequency noise, then forests.
import { GameMap } from './GameMap';
import { fbm2 } from './noise';
import { TileType } from './tiles';
import { TreePlacer } from './TreePlacer';
import { World } from './World';

/** Generation tuning. Frozen so maps stay reproducible; tune by editing these values here. */
export const MAPGEN_CONFIG = Object.freeze({
  seaLevel: 0,
  /** Height range of the hill noise. */
  maxHeight: 10,
  /** Hill noise frequency per tile, and its octaves. */
  noiseScale: 1 / 32,
  octaves: 4,
  /** Base height added inland (scaled by the island shape), so hill noise rarely floods the interior. */
  coastLift: 3.5,
  /** Height subtracted everywhere; sets where the island shape meets the sea. */
  shoreDrop: 3.1,
  sandBand: 0.5,
  rockSlope: 0.45,
  rockAltitude: 5.6,
  /** Coastline wobble: noise cycles across the whole map, its octaves, and how far (in half-map units) it moves the coast. */
  coastFrequency: 4,
  coastOctaves: 3,
  coastWarp: 0.9,
  /** Along the map border, a zone 1/borderSteepness half-maps wide pushes the island shape down towards the sea. */
  borderSteepness: 8,
});

/** Seed offset for the coastline noise, so it differs from the terrain noise (which uses seed + octave). */
const COAST_SEED_OFFSET = 0x5eed;
/** Samples per axis when averaging the coastline noise. */
const WOBBLE_SAMPLES = 16;

export interface MapParams {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
}

/** Per-map values shared by every corner height computation. */
interface IslandShape extends MapParams {
  readonly wobbleMean: number;
}

export class MapGenerator {
  private readonly treePlacer = new TreePlacer();

  /** Builds a new world (terrain, then trees) for `params`; the same params always give the same world. The seed is taken as unsigned 32-bit. */
  public generate(params: MapParams): World {
    const world = new World(this.generateTerrain(params));
    this.treePlacer.place(world, world.map.seed);
    return world;
  }

  private generateTerrain(params: MapParams): GameMap {
    const { width, height } = params;
    const seed = params.seed >>> 0;
    const stride = width + 1;
    const heights = new Float32Array(stride * (height + 1));
    const shape: IslandShape = { seed, width, height, wobbleMean: this.coastWobbleMean(seed) };
    for (let cy = 0; cy <= height; cy++) {
      for (let cx = 0; cx <= width; cx++) {
        heights[cy * stride + cx] = this.cornerHeight(shape, cx, cy);
      }
    }
    const tiles = new Uint8Array(width * height);
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        const i = ty * stride + tx;
        tiles[ty * width + tx] = this.classifyTile([
          heights[i],
          heights[i + 1],
          heights[i + stride],
          heights[i + stride + 1],
        ]);
      }
    }
    return new GameMap(width, height, seed, heights, tiles);
  }

  /** Mean of the coastline noise over the map, so the wobble moves the coast in and out without changing island size much. */
  private coastWobbleMean(seed: number): number {
    const c = MAPGEN_CONFIG;
    let sum = 0;
    for (let j = 0; j < WOBBLE_SAMPLES; j++) {
      for (let i = 0; i < WOBBLE_SAMPLES; i++) {
        const u = (i + 0.5) / WOBBLE_SAMPLES;
        const v = (j + 0.5) / WOBBLE_SAMPLES;
        sum += fbm2(seed + COAST_SEED_OFFSET, u * c.coastFrequency, v * c.coastFrequency, c.coastOctaves);
      }
    }
    return sum / (WOBBLE_SAMPLES * WOBBLE_SAMPLES);
  }

  private cornerHeight(shape: IslandShape, cx: number, cy: number): number {
    const c = MAPGEN_CONFIG;
    const { seed, width, height } = shape;
    // Corners of the outermost tiles stay under water, whatever the noise says.
    if (cx <= 1 || cy <= 1 || cx >= width - 1 || cy >= height - 1) return c.seaLevel - c.shoreDrop;
    const u = cx / width;
    const v = cy / height;
    const dx = Math.abs(u * 2 - 1);
    const dy = Math.abs(v * 2 - 1);
    // Round island whose radius wobbles with low-frequency noise (bays, peninsulas).
    const wobble = fbm2(seed + COAST_SEED_OFFSET, u * c.coastFrequency, v * c.coastFrequency, c.coastOctaves);
    const radial = Math.sqrt(dx * dx + dy * dy) + c.coastWarp * 2 * (wobble - shape.wobbleMean);
    // Pushes the coast smoothly away from the map border instead of cutting it off in a straight line.
    const border = Math.max(0, 1 - (1 - Math.max(dx, dy)) * c.borderSteepness);
    const d = radial + border;
    const n = fbm2(seed, cx * c.noiseScale, cy * c.noiseScale, c.octaves);
    const s = 1 - d * d;
    return (c.maxHeight * n + c.coastLift) * s - c.shoreDrop;
  }

  private classifyTile(corners: [number, number, number, number]): TileType {
    const c = MAPGEN_CONFIG;
    const avg = (corners[0] + corners[1] + corners[2] + corners[3]) / 4;
    const slope = Math.max(...corners) - Math.min(...corners);
    if (avg < c.seaLevel) return TileType.Water;
    if (avg < c.seaLevel + c.sandBand) return TileType.Sand;
    if (slope > c.rockSlope || avg > c.rockAltitude) return TileType.Rock;
    return TileType.Grass;
  }
}

/**
 * 32-bit FNV-1a over the bytes of the map's `heights` and `tiles`, then each object's id, kind, tx and ty
 * (as little-endian int32) in id order. Use to compare worlds cheaply, e.g. between peers.
 */
export function worldChecksum(world: World): number {
  let hash = 0x811c9dc5;
  const feed = (bytes: Uint8Array): void => {
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 0x01000193);
    }
  };
  const { heights, tiles } = world.map;
  feed(new Uint8Array(heights.buffer, heights.byteOffset, heights.byteLength));
  feed(tiles);
  const fields = new DataView(new ArrayBuffer(16 * world.objectCount));
  let offset = 0;
  for (const object of world.objects()) {
    for (const value of [object.id, object.kind, object.tx, object.ty]) {
      fields.setInt32(offset, value, true);
      offset += 4;
    }
  }
  feed(new Uint8Array(fields.buffer));
  return hash >>> 0;
}
