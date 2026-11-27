// Where a building's floor sits on the terrain; shared by buildings, the ghost and what is drawn on buildings.
import { Footprint } from '../sim/Footprint';
import type { GameMap } from '../sim/GameMap';
import type { ObjectKind } from '../sim/ObjectKind';

/**
 * Floor height of a building of `kind` anchored at tile (tx, ty): the highest corner height under its footprint,
 * ignoring corners outside the map (0 when none is inside).
 */
export function floorHeight(map: GameMap, kind: ObjectKind, tx: number, ty: number): number {
  return Footprint.of(kind, tx, ty).cornerHeightRange(map)?.max ?? 0;
}
