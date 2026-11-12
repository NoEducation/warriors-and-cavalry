// A tile position on the map grid.

/** Tile (tx, ty) covers world x in [tx, tx+1] and z in [ty, ty+1]. */
export interface TileCoord {
  readonly tx: number;
  readonly ty: number;
}
