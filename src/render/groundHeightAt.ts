// Ground height under a world position, for things that follow the terrain loosely (the camera focus).
import type { GameMap } from '../sim/GameMap';

/** Mean height of the tile under world (x, z), clamped to the map; positions off the map use the nearest edge tile. */
export function groundHeightAt(map: GameMap, x: number, z: number): number {
  const tx = Math.min(map.width - 1, Math.max(0, Math.floor(x)));
  const ty = Math.min(map.height - 1, Math.max(0, Math.floor(z)));
  return map.tileHeight(tx, ty);
}
