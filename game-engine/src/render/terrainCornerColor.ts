// The colour of a terrain vertex, blended across quarry ground: corners that touch quarry ground take the mean colour of
// the tiles around them, so quarry stone fades into the rock and grass beside it instead of stopping at a line.
import type * as THREE from 'three';
import type { GameMap } from '../sim/GameMap';
import { TileType } from '../sim/tiles';
import { terrainVertexColor } from './terrainColor';

/** No tile: outside the map. */
const NONE = -1;

/**
 * Writes into `out` the colour of corner (cx, cy) of a tile of `type` and returns it; `scratch` is overwritten. Pure,
 * and allocation-free away from quarry ground, as it runs for every terrain vertex.
 */
export function terrainCornerColor(
  map: GameMap,
  type: TileType,
  cx: number,
  cy: number,
  out: THREE.Color,
  scratch: THREE.Color,
): THREE.Color {
  const a = tileOrNone(map, cx - 1, cy - 1);
  const b = tileOrNone(map, cx, cy - 1);
  const c = tileOrNone(map, cx - 1, cy);
  const d = tileOrNone(map, cx, cy);
  const q = TileType.Quarry;
  if (a !== q && b !== q && c !== q && d !== q) return terrainVertexColor(map, type, cx, cy, out);
  out.setRGB(0, 0, 0);
  let count = 0;
  for (const t of [a, b, c, d]) {
    if (t === NONE) continue;
    out.add(terrainVertexColor(map, t as TileType, cx, cy, scratch));
    count++;
  }
  return out.multiplyScalar(1 / count);
}

function tileOrNone(map: GameMap, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return NONE;
  return map.tiles[ty * map.width + tx];
}
