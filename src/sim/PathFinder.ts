// Deterministic multi-goal A* over the tile grid, 8 directions without corner cutting.
import { MinHeap } from './MinHeap';
import { PATH_CONFIG } from './pathConfig';
import type { TileCoord } from './TileCoord';

/** Whether a walker may stand on tile (tx, ty). Only called for tiles inside the grid. */
export type IsWalkable = (tx: number, ty: number) => boolean;

/** Neighbour offsets in a fixed order (straight first: up, left, right, down), so equal searches expand equally. */
const STEP_DX = [0, -1, 1, 0, -1, 1, -1, 1];
const STEP_DY = [-1, 0, 0, 1, -1, -1, 1, 1];

export class PathFinder {
  private readonly cost: Int32Array;
  private readonly parent: Int32Array;
  /** Search generation in which a tile's `cost` and `parent` were set. */
  private readonly seen: Uint32Array;
  /** Search generation in which a tile was expanded. */
  private readonly closed: Uint32Array;
  /** Search generation in which a tile was marked as a goal. */
  private readonly goal: Uint32Array;
  private readonly open = new MinHeap();
  /** Walkability of the 8 neighbours of the tile being expanded, in `STEP_DX`/`STEP_DY` order. */
  private readonly free = new Uint8Array(8);
  /** Goal coordinates for the heuristic; replaced by larger arrays when a search has more goals. */
  private goalX: Int32Array;
  private goalY: Int32Array;
  private goalCount = 0;
  private generation = 0;
  private expanded = 0;

  /** A path-finder for a `width` x `height` grid; allocates its search arrays once. */
  public constructor(private readonly width: number, private readonly height: number) {
    const size = width * height;
    this.cost = new Int32Array(size);
    this.parent = new Int32Array(size);
    this.seen = new Uint32Array(size);
    this.closed = new Uint32Array(size);
    this.goal = new Uint32Array(size);
    this.goalX = new Int32Array(64);
    this.goalY = new Int32Array(64);
  }

  /** Tiles expanded by the last `find`. */
  public get lastExpanded(): number {
    return this.expanded;
  }

  /**
   * The tiles to walk from `start` to the nearest reachable goal, excluding `start` and ending on that goal; `[]` when
   * `start` is a goal; null when `goals` is empty, no goal is reachable or the search exceeds `maxExpanded` expansions.
   * Repeated goals count once. The start tile need not be walkable. Among equal f the larger cost so far comes first,
   * then the smaller tile index, so it is deterministic.
   */
  public find(
    start: TileCoord,
    goals: readonly TileCoord[],
    isWalkable: IsWalkable,
    maxExpanded: number = PATH_CONFIG.maxExpanded,
  ): TileCoord[] | null {
    this.expanded = 0;
    if (!this.inGrid(start.tx, start.ty) || !this.markGoals(goals)) return null;
    const gen = this.generation;
    const startIndex = start.ty * this.width + start.tx;
    this.open.clear();
    this.seen[startIndex] = gen;
    this.cost[startIndex] = 0;
    this.parent[startIndex] = -1;
    this.open.push(startIndex, this.heuristic(start.tx, start.ty));
    for (let index = this.open.pop(); index !== -1; index = this.open.pop()) {
      if (this.closed[index] === gen) continue;
      if (this.goal[index] === gen) return this.pathTo(index);
      if (this.expanded >= maxExpanded) return null;
      this.expanded++;
      this.closed[index] = gen;
      this.expand(index, isWalkable);
    }
    return null;
  }

  /** Relaxes every walkable neighbour of `index` reachable without cutting a corner. */
  private expand(index: number, isWalkable: IsWalkable): void {
    const gen = this.generation;
    const x = index % this.width;
    const y = (index - x) / this.width;
    const free = this.free;
    for (let d = 0; d < 8; d++) {
      const nx = x + STEP_DX[d];
      const ny = y + STEP_DY[d];
      free[d] = this.inGrid(nx, ny) && isWalkable(nx, ny) ? 1 : 0;
    }
    for (let d = 0; d < 8; d++) {
      if (free[d] === 0) continue;
      const dx = STEP_DX[d];
      const dy = STEP_DY[d];
      const diagonal = d >= 4;
      // The side tiles of a diagonal step are the straight steps (dx, 0) and (0, dy): indices 1/2 and 0/3.
      if (diagonal && (free[dx < 0 ? 1 : 2] === 0 || free[dy < 0 ? 0 : 3] === 0)) continue;
      const nx = x + dx;
      const ny = y + dy;
      const next = ny * this.width + nx;
      if (this.closed[next] === gen) continue;
      const cost = this.cost[index] + (diagonal ? PATH_CONFIG.diagonalCost : PATH_CONFIG.straightCost);
      if (this.seen[next] === gen && cost >= this.cost[next]) continue;
      this.seen[next] = gen;
      this.cost[next] = cost;
      this.parent[next] = index;
      // Equal f: the larger cost so far (deeper node) first, then the smaller tile index.
      this.open.push(next, cost + this.heuristic(nx, ny), -cost);
    }
  }

  /** Starts a new generation and marks the in-grid goals, each once; false when there are none. */
  private markGoals(goals: readonly TileCoord[]): boolean {
    this.generation++;
    if (goals.length > this.goalX.length) {
      this.goalX = new Int32Array(goals.length);
      this.goalY = new Int32Array(goals.length);
    }
    this.goalCount = 0;
    for (const { tx, ty } of goals) {
      if (!this.inGrid(tx, ty) || this.goal[ty * this.width + tx] === this.generation) continue;
      this.goal[ty * this.width + tx] = this.generation;
      this.goalX[this.goalCount] = tx;
      this.goalY[this.goalCount] = ty;
      this.goalCount++;
    }
    return this.goalCount > 0;
  }

  /** Smallest octile distance from (x, y) to any goal, in step-cost units. */
  private heuristic(x: number, y: number): number {
    let best = 0x7fffffff;
    for (let i = 0; i < this.goalCount; i++) {
      const dx = Math.abs(this.goalX[i] - x);
      const dy = Math.abs(this.goalY[i] - y);
      const diagonal = Math.min(dx, dy);
      const h = diagonal * PATH_CONFIG.diagonalCost + (Math.max(dx, dy) - diagonal) * PATH_CONFIG.straightCost;
      if (h < best) best = h;
    }
    return best;
  }

  /** The tiles from just after the start up to `index`, following parents back. */
  private pathTo(index: number): TileCoord[] {
    const path: TileCoord[] = [];
    for (let i = index; this.parent[i] !== -1; i = this.parent[i]) {
      const tx = i % this.width;
      path.push({ tx, ty: (i - tx) / this.width });
    }
    return path.reverse();
  }

  private inGrid(tx: number, ty: number): boolean {
    return Number.isInteger(tx) && Number.isInteger(ty) && tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }
}
