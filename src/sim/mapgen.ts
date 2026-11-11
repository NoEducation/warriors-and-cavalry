// Deterministic island generator: fbm noise shaped by a square falloff.
import { GameMap } from './map';
import { fbm2 } from './noise';
import { TileType } from './tiles';

/** Generation tuning. Frozen so maps stay reproducible; tune by editing these values here. */
export const MAPGEN_CONFIG = Object.freeze({
  seaLevel: 0,
  maxHeight: 12,
  noiseScale: 1 / 32,
  octaves: 4,
  shoreDrop: 3,
  sandBand: 0.5,
  rockSlope: 0.45,
  rockAltitude: 3,
});

export interface MapParams {
  seed: number;
  width: number;
  height: number;
}

function cornerHeight(seed: number, cx: number, cy: number, width: number, height: number): number {
  const c = MAPGEN_CONFIG;
  const dx = Math.abs((cx / width) * 2 - 1);
  const dy = Math.abs((cy / height) * 2 - 1);
  const d = Math.max(dx, dy); // 0 at centre, 1 on the border
  const n = fbm2(seed, cx * c.noiseScale, cy * c.noiseScale, c.octaves);
  return c.maxHeight * n * (1 - d * d) - c.shoreDrop;
}

function classifyTile(corners: [number, number, number, number]): TileType {
  const c = MAPGEN_CONFIG;
  const avg = (corners[0] + corners[1] + corners[2] + corners[3]) / 4;
  const slope = Math.max(...corners) - Math.min(...corners);
  if (avg < c.seaLevel) return TileType.Water;
  if (avg < c.seaLevel + c.sandBand) return TileType.Sand;
  if (slope > c.rockSlope || avg > c.rockAltitude) return TileType.Rock;
  return TileType.Grass;
}

export function generateMap(params: MapParams): GameMap {
  const { width, height } = params;
  const seed = params.seed >>> 0;
  const stride = width + 1;
  const heights = new Float32Array(stride * (height + 1));
  for (let cy = 0; cy <= height; cy++) {
    for (let cx = 0; cx <= width; cx++) {
      heights[cy * stride + cx] = cornerHeight(seed, cx, cy, width, height);
    }
  }
  const tiles = new Uint8Array(width * height);
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const i = ty * stride + tx;
      tiles[ty * width + tx] = classifyTile([heights[i], heights[i + 1], heights[i + stride], heights[i + stride + 1]]);
    }
  }
  return new GameMap(width, height, seed, heights, tiles);
}

/** 32-bit FNV-1a over the bytes of `heights` followed by `tiles`. */
export function mapChecksum(map: GameMap): number {
  let hash = 0x811c9dc5;
  const feed = (bytes: Uint8Array): void => {
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 0x01000193);
    }
  };
  const h = map.heights;
  feed(new Uint8Array(h.buffer, h.byteOffset, h.byteLength));
  feed(map.tiles);
  return hash >>> 0;
}
