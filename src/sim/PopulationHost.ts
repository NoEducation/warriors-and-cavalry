// What the population needs to know about the world it lives in.
import type { GameMap } from './GameMap';
import type { MapObject } from './MapObject';
import type { IsWalkable } from './PathFinder';
import type { TileCoord } from './TileCoord';

/** The world as `Population` and its helpers see it. `World` is one. */
export interface PopulationHost {
  readonly map: GameMap;
  isWalkable: IsWalkable;
  accessTiles(objectId: number): TileCoord[];
  objectById(id: number): MapObject | undefined;
  objectAt(tx: number, ty: number): MapObject | undefined;
  objects(): Iterable<MapObject>;
}
