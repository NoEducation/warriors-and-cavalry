// The tiles of a dragged wall: an 8-connected Bresenham line, cut to a maximum length. Integer arithmetic only.
import type { TileCoord } from './TileCoord';

/** Wall drag tuning. Frozen; tune by editing the values here. */
export const WALL_LINE_CONFIG = Object.freeze({
  /** The most tiles one wall line may have; a longer line is cut to its first tiles from the start. */
  maxTiles: 64,
});

/**
 * The tiles of the Bresenham line from `from` to `to`, both included, in order from `from`; consecutive tiles share
 * an edge or a corner, and no tile repeats. Cut to the first `WALL_LINE_CONFIG.maxTiles` tiles. The same inputs always give
 * the same tiles (swapping `from` and `to` may give a different staircase). Expects whole-number coordinates.
 */
export function wallLineTiles(from: TileCoord, to: TileCoord): TileCoord[] {
  const dx = Math.abs(to.tx - from.tx);
  const dy = -Math.abs(to.ty - from.ty);
  const sx = from.tx < to.tx ? 1 : -1;
  const sy = from.ty < to.ty ? 1 : -1;
  const tiles: TileCoord[] = [];
  let { tx, ty } = from;
  let error = dx + dy;
  // The length cap also ends the loop for coordinates that are not whole numbers.
  while (tiles.length < WALL_LINE_CONFIG.maxTiles) {
    tiles.push({ tx, ty });
    if (tx === to.tx && ty === to.ty) break;
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      tx += sx;
    }
    if (doubled <= dx) {
      error += dx;
      ty += sy;
    }
  }
  return tiles;
}
