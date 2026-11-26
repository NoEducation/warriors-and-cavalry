// The colour of a terrain vertex, blended across quarry ground: corners that touch quarry ground take the mean colour of
// the tiles around them, so quarry stone fades into the rock and grass beside it instead of stopping at a line.
import type * as THREE from 'three';
import type { GameMap } from '../sim/GameMap';
import { TileType } from '../sim/tiles';
import { terrainVertexColor } from './terrainColor';

/** Writes into `out` the colour of corner (cx, cy) of a tile of `type` and returns it. Pure; call once per vertex. */
export function terrainCornerColor(
  map: GameMap,
  type: TileType,
  cx: number,
  cy: number,
  out: THREE.Color,
  scratch: THREE.Color,
): THREE.Color {
  const around: TileType[] = [];
  for (const [tx, ty] of [[cx - 1, cy - 1], [cx, cy - 1], [cx - 1, cy], [cx, cy]]) {
    const t = map.tileAt(tx, ty);
    if (t !== undefined) around.push(t);
  }
  if (!around.includes(TileType.Quarry)) return terrainVertexColor(map, type, cx, cy, out);
  out.setRGB(0, 0, 0);
  for (const t of around) out.add(terrainVertexColor(map, t, cx, cy, scratch));
  return out.multiplyScalar(1 / around.length);
}
