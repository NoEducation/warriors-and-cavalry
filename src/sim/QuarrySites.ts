// Quarry ground: small, nearly flat shelves of grassland at the foot of mountains, the only places quarries may stand.
import { hash2 } from './rng';
import { TileType } from './tiles';

/** Quarry site tuning. Frozen so maps stay reproducible; tune by editing these values here. */
export const QUARRY_CONFIG = Object.freeze({
  /** Side of a site in tiles; a 3 x 3 quarry fits anywhere on it. */
  siteSize: 5,
  /** Candidate sites are tested every this many tiles along each axis. */
  stride: 2,
  /** Largest corner height range under a candidate block; steeper ground would need a cliff cut to flatten. */
  maxRange: 2.2,
  /** How many tiles around the block are searched for mountain rock, and how many such rock tiles it needs. */
  ringWidth: 2,
  minRockTiles: 5,
  /** How far above the block's mean height a rock tile must stand to count as mountain. */
  mountainRise: 1.2,
  /** Least distance in tiles between the top-left corners of two sites (along the larger axis), and the most sites. */
  minSpacing: 34,
  maxSites: 14,
  /** Share of the block's original tilt kept after flattening, and the largest height range it may keep. */
  keepTilt: 0.3,
  maxTiltRange: 0.5,
  /** Mixed into the map seed for the order in which candidates are taken. */
  seedSalt: 0x9a1e,
});

/** The top-left tile of a quarry site; it covers QUARRY_CONFIG.siteSize tiles along each axis. */
export interface QuarrySite {
  readonly tx: number;
  readonly ty: number;
}

/** The corner heights of a map being generated, (width+1) x (height+1), and its size in tiles. */
export interface HeightGrid {
  readonly heights: Float32Array;
  readonly width: number;
  readonly height: number;
}

export class QuarrySites {
  /**
   * Picks quarry sites at the foot of mountains and flattens the corner heights under them in `grid`. `classify`
   * gives the type a tile would have from the current heights. Call once while generating, before classifying tiles,
   * then pass the result to `mark`.
   */
  public carve(grid: HeightGrid, seed: number, classify: (tx: number, ty: number) => TileType): QuarrySite[] {
    const c = QUARRY_CONFIG;
    const candidates: { site: QuarrySite; order: number }[] = [];
    for (let ty = c.ringWidth; ty + c.siteSize + c.ringWidth <= grid.height; ty += c.stride) {
      for (let tx = c.ringWidth; tx + c.siteSize + c.ringWidth <= grid.width; tx += c.stride) {
        if (this.isFoothill(grid, tx, ty, classify)) {
          candidates.push({ site: { tx, ty }, order: hash2((seed ^ c.seedSalt) | 0, tx, ty) });
        }
      }
    }
    // Ties in the hash are broken by position, so the order never depends on the sort's stability.
    candidates.sort((a, b) => a.order - b.order || a.site.ty - b.site.ty || a.site.tx - b.site.tx);
    const sites: QuarrySite[] = [];
    for (const { site } of candidates) {
      if (sites.length >= c.maxSites) break;
      const far = sites.every((s) => Math.max(Math.abs(s.tx - site.tx), Math.abs(s.ty - site.ty)) >= c.minSpacing);
      if (!far) continue;
      sites.push(site);
      this.flatten(grid, site);
    }
    return sites;
  }

  /** Sets every tile of each site in `tiles` (width tiles per row) to quarry ground. Call after classifying tiles. */
  public mark(tiles: Uint8Array, width: number, sites: readonly QuarrySite[]): void {
    const size = QUARRY_CONFIG.siteSize;
    for (const { tx, ty } of sites) {
      for (let y = ty; y < ty + size; y++) for (let x = tx; x < tx + size; x++) tiles[y * width + x] = TileType.Quarry;
    }
  }

  /** All-grass block, gentle enough to flatten, with enough mountain rock in the ring around it. */
  private isFoothill(grid: HeightGrid, tx: number, ty: number, classify: (tx: number, ty: number) => TileType): boolean {
    const c = QUARRY_CONFIG;
    for (let y = ty; y < ty + c.siteSize; y++) {
      for (let x = tx; x < tx + c.siteSize; x++) if (classify(x, y) !== TileType.Grass) return false;
    }
    const { min, max, mean } = this.blockStats(grid, tx, ty);
    if (max - min > c.maxRange) return false;
    let rock = 0;
    for (let y = ty - c.ringWidth; y < ty + c.siteSize + c.ringWidth; y++) {
      for (let x = tx - c.ringWidth; x < tx + c.siteSize + c.ringWidth; x++) {
        if (classify(x, y) !== TileType.Rock) continue;
        if (this.tileMean(grid, x, y) >= mean + c.mountainRise) rock++;
      }
    }
    return rock >= c.minRockTiles;
  }

  /** Levels the site's corners to their mean height, keeping a little of their original tilt. */
  private flatten(grid: HeightGrid, site: QuarrySite): void {
    const c = QUARRY_CONFIG;
    const n = c.siteSize;
    const stride = grid.width + 1;
    const at = (x: number, y: number): number => grid.heights[(site.ty + y) * stride + site.tx + x];
    const { mean } = this.blockStats(grid, site.tx, site.ty);
    let gx = 0;
    let gy = 0;
    for (let i = 0; i <= n; i++) {
      gx += (at(n, i) - at(0, i)) / n;
      gy += (at(i, n) - at(i, 0)) / n;
    }
    gx = (gx / (n + 1)) * c.keepTilt;
    gy = (gy / (n + 1)) * c.keepTilt;
    // Limit the kept tilt so a quarry anywhere on the site stays well within the slope limit.
    const range = (Math.abs(gx) + Math.abs(gy)) * n;
    const scale = range > c.maxTiltRange ? c.maxTiltRange / range : 1;
    for (let y = 0; y <= n; y++) {
      for (let x = 0; x <= n; x++) {
        grid.heights[(site.ty + y) * stride + site.tx + x] = mean + scale * (gx * (x - n / 2) + gy * (y - n / 2));
      }
    }
  }

  private blockStats(grid: HeightGrid, tx: number, ty: number): { min: number; max: number; mean: number } {
    const n = QUARRY_CONFIG.siteSize;
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

  private tileMean(grid: HeightGrid, tx: number, ty: number): number {
    const s = grid.width + 1;
    const h = grid.heights;
    return (h[ty * s + tx] + h[ty * s + tx + 1] + h[(ty + 1) * s + tx] + h[(ty + 1) * s + tx + 1]) / 4;
  }
}
