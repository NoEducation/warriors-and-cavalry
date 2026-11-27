// The goals of one path search: which tiles end it, and the distance estimate toward the nearest of them.
import { PATH_CONFIG } from './pathConfig';
import type { TileCoord } from './TileCoord';

export class PathGoals {
  /** Search generation in which a tile was marked as a goal. */
  private readonly mark: Uint32Array;
  /** Goal coordinates for the estimate; replaced by larger arrays when a search has more goals. */
  private goalX = new Int32Array(64);
  private goalY = new Int32Array(64);
  private count = 0;

  /** Goals on a grid `width` tiles wide and `height` high; allocates its marks once. */
  public constructor(private readonly width: number, private readonly height: number) {
    this.mark = new Uint32Array(width * height);
  }

  /**
   * Marks the in-grid tiles of `goals` as the goals of search `generation`, each once; false when none is in the grid.
   * Call at the start of each search with a new generation.
   */
  public set(goals: readonly TileCoord[], generation: number): boolean {
    if (goals.length > this.goalX.length) {
      this.goalX = new Int32Array(goals.length);
      this.goalY = new Int32Array(goals.length);
    }
    this.count = 0;
    for (const { tx, ty } of goals) {
      const inGrid = Number.isInteger(tx) && Number.isInteger(ty) && tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
      if (!inGrid || this.mark[ty * this.width + tx] === generation) continue;
      this.mark[ty * this.width + tx] = generation;
      this.goalX[this.count] = tx;
      this.goalY[this.count] = ty;
      this.count++;
    }
    return this.count > 0;
  }

  /** True when tile `index` (`ty * width + tx`) is a goal of search `generation`. */
  public has(index: number, generation: number): boolean {
    return this.mark[index] === generation;
  }

  /** Smallest octile distance from (x, y) to any goal, in step-cost units. */
  public estimate(x: number, y: number): number {
    let best = 0x7fffffff;
    for (let i = 0; i < this.count; i++) {
      const dx = Math.abs(this.goalX[i] - x);
      const dy = Math.abs(this.goalY[i] - y);
      const diagonal = Math.min(dx, dy);
      const h = diagonal * PATH_CONFIG.diagonalCost + (Math.max(dx, dy) - diagonal) * PATH_CONFIG.straightCost;
      if (h < best) best = h;
    }
    return best;
  }
}
