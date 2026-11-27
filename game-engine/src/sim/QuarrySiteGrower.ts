// Grows a quarry site's irregular outline from its flat core into the mountain foot, and eases the new ground into it.
import { fbm2 } from './noise';
import { TileType } from './tiles';

/** Growth tuning. Frozen so maps stay reproducible; tune by editing these values here. */
export const QUARRY_GROWTH_CONFIG = Object.freeze({
  /** Furthest a site grows from its core, in tiles (Chebyshev distance). */
  growRadius: 3,
  /** Shape noise frequency per tile; a tile joins when noise + bonuses - distance * distanceWeight > threshold. */
  growScale: 1 / 2.5,
  distanceWeight: 0.16,
  rockBonus: 0.15,
  threshold: 0.25,
  /** Grown tiles must lie within this far below or above the core's mean height. */
  maxDrop: 1,
  maxRise: 1.8,
  /** How far grown corners move towards the core's plane (0 keeps them, 1 levels them). */
  easeShare: 0.5,
  seedSalt: 0x6b2d,
});

/** The corner heights of a map being generated, (width+1) x (height+1), and its size in tiles. */
export interface HeightGrid {
  readonly heights: Float32Array;
  readonly width: number;
  readonly height: number;
}

/** A site's flat core: its top-left tile, its side in tiles, and the tilted plane its corners were set to. */
export interface QuarryCore {
  readonly tx: number;
  readonly ty: number;
  readonly size: number;
  readonly plane: (cx: number, cy: number) => number;
}

export class QuarrySiteGrower {
  /**
   * Every tile of the site grown from `core`, as tile indices (ty * width + tx) in the order they joined, core first.
   * Eases the corners of the grown tiles in `grid` towards the core's plane. Pure apart from those heights.
   */
  public grow(grid: HeightGrid, core: QuarryCore, seed: number, classify: (tx: number, ty: number) => TileType): number[] {
    const { width } = grid;
    const inSite = new Set<number>();
    const tiles: number[] = [];
    for (let y = core.ty; y < core.ty + core.size; y++) {
      for (let x = core.tx; x < core.tx + core.size; x++) {
        inSite.add(y * width + x);
        tiles.push(y * width + x);
      }
    }
    const coreMean = core.plane(core.tx + core.size / 2, core.ty + core.size / 2);
    const rejected = new Set<number>();
    for (let q = 0; q < tiles.length; q++) {
      const tx = tiles[q] % width;
      const ty = Math.floor(tiles[q] / width);
      for (const [x, y] of [[tx, ty - 1], [tx - 1, ty], [tx + 1, ty], [tx, ty + 1]]) {
        const i = y * width + x;
        if (inSite.has(i) || rejected.has(i)) continue;
        if (this.joins(grid, core, coreMean, x, y, seed, classify)) {
          inSite.add(i);
          tiles.push(i);
        } else {
          rejected.add(i);
        }
      }
    }
    this.ease(grid, core, tiles.slice(core.size * core.size));
    return tiles;
  }

  private joins(
    grid: HeightGrid,
    core: QuarryCore,
    coreMean: number,
    x: number,
    y: number,
    seed: number,
    classify: (tx: number, ty: number) => TileType,
  ): boolean {
    const c = QUARRY_GROWTH_CONFIG;
    if (x < 1 || y < 1 || x >= grid.width - 1 || y >= grid.height - 1) return false;
    const distance = Math.max(core.tx - x, x - (core.tx + core.size - 1), core.ty - y, y - (core.ty + core.size - 1));
    if (distance > c.growRadius) return false;
    const type = classify(x, y);
    if (type !== TileType.Grass && type !== TileType.Rock) return false;
    const h = this.tileMean(grid, x, y);
    if (h < coreMean - c.maxDrop || h > coreMean + c.maxRise) return false;
    const nextToRock = [classify(x - 1, y), classify(x + 1, y), classify(x, y - 1), classify(x, y + 1)].includes(
      TileType.Rock,
    );
    const noise = fbm2((seed ^ c.seedSalt) | 0, x * c.growScale, y * c.growScale, 2);
    return noise + (nextToRock || type === TileType.Rock ? c.rockBonus : 0) - distance * c.distanceWeight > c.threshold;
  }

  /** Moves each corner of the grown tiles (not the core's) part of the way to the core's plane, once. */
  private ease(grid: HeightGrid, core: QuarryCore, grown: readonly number[]): void {
    const stride = grid.width + 1;
    const done = new Set<number>();
    for (const tile of grown) {
      const tx = tile % grid.width;
      const ty = Math.floor(tile / grid.width);
      for (const [cx, cy] of [[tx, ty], [tx + 1, ty], [tx, ty + 1], [tx + 1, ty + 1]]) {
        const inCore = cx >= core.tx && cx <= core.tx + core.size && cy >= core.ty && cy <= core.ty + core.size;
        const i = cy * stride + cx;
        if (inCore || done.has(i)) continue;
        done.add(i);
        grid.heights[i] += (core.plane(cx, cy) - grid.heights[i]) * QUARRY_GROWTH_CONFIG.easeShare;
      }
    }
  }

  private tileMean(grid: HeightGrid, tx: number, ty: number): number {
    const s = grid.width + 1;
    const h = grid.heights;
    return (h[ty * s + tx] + h[ty * s + tx + 1] + h[(ty + 1) * s + tx] + h[(ty + 1) * s + tx + 1]) / 4;
  }
}
