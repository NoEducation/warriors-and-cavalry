// The objects standing on a map: by id and by tile, and the read-only questions asked about them.
import { Footprint } from './Footprint';
import type { GameMap } from './GameMap';
import type { MapObject } from './MapObject';
import { ObjectKind } from './ObjectKind';
import type { TileCoord } from './TileCoord';
import { TileType } from './tiles';

export class ObjectIndex {
  /** Object id per tile (index ty*width+tx); 0 means free. */
  private readonly occupancy: Int32Array;
  /** Ids only increase and are never reused, so insertion order is ascending id order. */
  private readonly byId = new Map<number, MapObject>();

  /** An empty index for `map`. */
  public constructor(private readonly map: GameMap) {
    this.occupancy = new Int32Array(map.width * map.height);
  }

  /** Number of objects in the index. */
  public get count(): number {
    return this.byId.size;
  }

  /** The object with `id`, or undefined when there is none. */
  public objectById(id: number): MapObject | undefined {
    return this.byId.get(id);
  }

  /** The object covering tile (tx, ty), or undefined when the tile is free or outside the map. */
  public objectAt(tx: number, ty: number): MapObject | undefined {
    if (!this.map.inBounds(tx, ty)) return undefined;
    const id = this.occupancy[ty * this.map.width + tx];
    return id === 0 ? undefined : this.byId.get(id);
  }

  /** All objects in ascending id order. Do not add or remove objects while iterating. */
  public objects(): Iterable<MapObject> {
    return this.byId.values();
  }

  /** Whether a walker may stand on tile (tx, ty): inside the map, not water, and free or a tree. */
  public isWalkable(tx: number, ty: number): boolean {
    const tile = this.map.tileAt(tx, ty);
    if (tile === undefined || tile === TileType.Water) return false;
    const object = this.objectAt(tx, ty);
    return object === undefined || object.kind === ObjectKind.Tree;
  }

  /** The walkable tiles sharing an edge with object `objectId`, row by row; [] for an unknown id. */
  public accessTiles(objectId: number): TileCoord[] {
    const object = this.byId.get(objectId);
    if (!object) return [];
    const edge = Footprint.of(object.kind, object.tx, object.ty).edgeNeighbours();
    return [...edge].filter((tile) => this.isWalkable(tile.tx, tile.ty));
  }

  /** True when no object covers any tile of `footprint`. Assumes the footprint is in bounds. */
  public isFree(footprint: Footprint): boolean {
    for (const tile of footprint.tiles()) {
      if (this.occupancy[tile.ty * this.map.width + tile.tx] !== 0) return false;
    }
    return true;
  }

  /** Records `object` on its (in-bounds, free) footprint. Its id must be larger than every id seen so far. */
  public insert(object: MapObject): void {
    this.byId.set(object.id, object);
    this.fill(Footprint.of(object.kind, object.tx, object.ty), object.id);
  }

  /** Forgets `object` and frees its footprint. */
  public remove(object: MapObject): void {
    this.fill(Footprint.of(object.kind, object.tx, object.ty), 0);
    this.byId.delete(object.id);
  }

  /** Writes `id` (0 frees) into every tile of an in-bounds footprint. */
  private fill(footprint: Footprint, id: number): void {
    for (const tile of footprint.tiles()) this.occupancy[tile.ty * this.map.width + tile.tx] = id;
  }
}
