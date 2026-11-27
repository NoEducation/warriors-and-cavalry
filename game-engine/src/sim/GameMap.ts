// Grid map data: corner heights and per-tile terrain types.
import type { TileType } from './tiles';

export class GameMap {
  public readonly width: number;
  public readonly height: number;
  public readonly seed: number;
  /** Corner heights, (width+1)*(height+1), index cy*(width+1)+cx. */
  public readonly heights: Float32Array;
  /** Tile types, width*height, index ty*width+tx. */
  public readonly tiles: Uint8Array;

  /** Wraps already generated arrays; throws a RangeError when their lengths do not match the size. */
  public constructor(width: number, height: number, seed: number, heights: Float32Array, tiles: Uint8Array) {
    const cornerCount = (width + 1) * (height + 1);
    if (heights.length !== cornerCount) {
      throw new RangeError(`heights length ${heights.length}, expected ${cornerCount}`);
    }
    if (tiles.length !== width * height) {
      throw new RangeError(`tiles length ${tiles.length}, expected ${width * height}`);
    }
    this.width = width;
    this.height = height;
    this.seed = seed;
    this.heights = heights;
    this.tiles = tiles;
  }

  /** True when (tx, ty) is an integer tile position inside the map. Call before indexing tiles yourself. */
  public inBounds(tx: number, ty: number): boolean {
    return (
      Number.isInteger(tx) && Number.isInteger(ty) && tx >= 0 && ty >= 0 && tx < this.width && ty < this.height
    );
  }

  /** Terrain type of tile (tx, ty), or undefined when the tile is outside the map. */
  public tileAt(tx: number, ty: number): TileType | undefined {
    if (!this.inBounds(tx, ty)) return undefined;
    return this.tiles[ty * this.width + tx] as TileType;
  }

  /** Height of corner (cx, cy), with cx in 0..width and cy in 0..height. Throws a RangeError outside that. */
  public heightAt(cx: number, cy: number): number {
    if (!Number.isInteger(cx) || !Number.isInteger(cy) || cx < 0 || cy < 0 || cx > this.width || cy > this.height) {
      throw new RangeError(`corner (${cx}, ${cy}) out of bounds`);
    }
    return this.heights[cy * (this.width + 1) + cx];
  }

  /** Mean height of the four corners of tile (tx, ty). Throws a RangeError for a tile outside the map. */
  public tileHeight(tx: number, ty: number): number {
    if (!this.inBounds(tx, ty)) {
      throw new RangeError(`tile (${tx}, ${ty}) out of bounds`);
    }
    return (
      (this.heightAt(tx, ty) + this.heightAt(tx + 1, ty) + this.heightAt(tx, ty + 1) + this.heightAt(tx + 1, ty + 1)) /
      4
    );
  }
}
