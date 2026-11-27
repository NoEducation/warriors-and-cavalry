// Quarry ground: irregular, nearly flat shelves at the foot of mountains, the only places quarries may stand.
import { QuarrySiteGrower, type HeightGrid, type QuarryCore } from './QuarrySiteGrower';
import { hash2 } from './rng';
import { TileType } from './tiles';

export type { HeightGrid } from './QuarrySiteGrower';

/** Quarry site tuning. Frozen so maps stay reproducible; tune by editing these values here. */
export const QUARRY_CONFIG = Object.freeze({
  /** Side in tiles of a site's flat core; a 3 x 3 quarry fits anywhere on it. The site grows out from there. */
  coreSize: 4,
  /** Candidate cores are tested every this many tiles along each axis. */
  stride: 2,
  /** Largest corner height range under a candidate core; steeper ground would need a cliff cut to flatten. */
  maxRange: 2.2,
  /** How many tiles around the core are searched for mountain rock, and how many such rock tiles it needs. */
  ringWidth: 2,
  minRockTiles: 5,
  /** How far above the core's mean height a rock tile must stand to count as mountain. */
  mountainRise: 1.2,
  /** Least distance in tiles between the top-left corners of two cores (along the larger axis), and the most sites. */
  minSpacing: 34,
  maxSites: 14,
  /** Share of the core's original tilt kept after flattening, and the largest height range it may keep. */
  keepTilt: 0.3,
  maxTiltRange: 0.5,
  /** Mixed into the map seed for the order in which candidates are taken. */
  seedSalt: 0x9a1e,
});

/** A quarry site: its core's top-left tile and every tile it covers, as tile indices (ty * width + tx). */
export interface QuarrySite {
  readonly tx: number;
  readonly ty: number;
  readonly tiles: readonly number[];
}

export class QuarrySites {
  private readonly grower = new QuarrySiteGrower();

  /**
   * Picks quarry sites at the foot of mountains, flattens their cores and grows their outlines, changing the corner
   * heights in `grid`. `classify` gives the type a tile would have from the current heights. Call once while
   * generating, before classifying tiles, then pass the result to `mark`.
   */
  public carve(grid: HeightGrid, seed: number, classify: (tx: number, ty: number) => TileType): QuarrySite[] {
    const c = QUARRY_CONFIG;
    const candidates: { tx: number; ty: number; order: number }[] = [];
    for (let ty = c.ringWidth; ty + c.coreSize + c.ringWidth <= grid.height; ty += c.stride) {
      for (let tx = c.ringWidth; tx + c.coreSize + c.ringWidth <= grid.width; tx += c.stride) {
        if (this.isFoothill(grid, tx, ty, classify)) candidates.push({ tx, ty, order: hash2((seed ^ c.seedSalt) | 0, tx, ty) });
      }
    }
    // Ties in the hash are broken by position, so the order never depends on the sort's stability.
    candidates.sort((a, b) => a.order - b.order || a.ty - b.ty || a.tx - b.tx);
    const sites: QuarrySite[] = [];
    for (const { tx, ty } of candidates) {
      if (sites.length >= c.maxSites) break;
      if (!sites.every((s) => Math.max(Math.abs(s.tx - tx), Math.abs(s.ty - ty)) >= c.minSpacing)) continue;
      const core: QuarryCore = { tx, ty, size: c.coreSize, plane: this.flatten(grid, tx, ty) };
      sites.push({ tx, ty, tiles: this.grower.grow(grid, core, seed, classify) });
    }
    return sites;
  }

  /** Sets every tile of each site in `tiles` to quarry ground. Call after classifying tiles. */
  public mark(tiles: Uint8Array, sites: readonly QuarrySite[]): void {
    for (const site of sites) for (const i of site.tiles) tiles[i] = TileType.Quarry;
  }

  /** All-grass block, gentle enough to flatten, with enough mountain rock in the ring around it. */
  private isFoothill(grid: HeightGrid, tx: number, ty: number, classify: (tx: number, ty: number) => TileType): boolean {
    const c = QUARRY_CONFIG;
    for (let y = ty; y < ty + c.coreSize; y++) {
      for (let x = tx; x < tx + c.coreSize; x++) if (classify(x, y) !== TileType.Grass) return false;
    }
    const { min, max, mean } = this.blockStats(grid, tx, ty);
    if (max - min > c.maxRange) return false;
    let rock = 0;
    for (let y = ty - c.ringWidth; y < ty + c.coreSize + c.ringWidth; y++) {
      for (let x = tx - c.ringWidth; x < tx + c.coreSize + c.ringWidth; x++) {
        if (classify(x, y) !== TileType.Rock) continue;
        const s = grid.width + 1;
        const h = grid.heights;
        const tileMean = (h[y * s + x] + h[y * s + x + 1] + h[(y + 1) * s + x] + h[(y + 1) * s + x + 1]) / 4;
        if (tileMean >= mean + c.mountainRise) rock++;
      }
    }
    return rock >= c.minRockTiles;
  }

  /** Levels the core's corners to their mean height, keeping a little of their tilt; returns that plane. */
  private flatten(grid: HeightGrid, tx: number, ty: number): (cx: number, cy: number) => number {
    const c = QUARRY_CONFIG;
    const n = c.coreSize;
    const stride = grid.width + 1;
    const at = (x: number, y: number): number => grid.heights[(ty + y) * stride + tx + x];
    const { mean } = this.blockStats(grid, tx, ty);
    let gx = 0;
    let gy = 0;
    for (let i = 0; i <= n; i++) {
      gx += (at(n, i) - at(0, i)) / n;
      gy += (at(i, n) - at(i, 0)) / n;
    }
    gx = (gx / (n + 1)) * c.keepTilt;
    gy = (gy / (n + 1)) * c.keepTilt;
    // Limit the kept tilt so a quarry anywhere on the core stays well within the slope limit.
    const range = (Math.abs(gx) + Math.abs(gy)) * n;
    const scale = range > c.maxTiltRange ? c.maxTiltRange / range : 1;
    const plane = (cx: number, cy: number): number =>
      mean + scale * (gx * (cx - tx - n / 2) + gy * (cy - ty - n / 2));
    for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) grid.heights[(ty + y) * stride + tx + x] = plane(tx + x, ty + y);
    return plane;
  }

  private blockStats(grid: HeightGrid, tx: number, ty: number): { min: number; max: number; mean: number } {
    const n = QUARRY_CONFIG.coreSize;
    const stride = grid.width + 1;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (let y = ty; y <= ty + n; y++) {
      for (let x = tx; x <= tx + n; x++) {
        const h = grid.heights[y * stride + x];
        min = Math.min(min, h);
        max = Math.max(max, h);
        sum += h;
      }
    }
    return { min, max, mean: sum / ((n + 1) * (n + 1)) };
  }
}
