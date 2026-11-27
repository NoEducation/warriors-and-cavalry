// Deterministic multi-goal A* over the tile grid, 8 directions, each step allowed by the walk rules (no corner cutting
// on the ground; the wall walk only by stairs).
import { MinHeap } from './MinHeap';
import { PathGoals } from './PathGoals';
import { PATH_CONFIG } from './pathConfig';
import type { TileCoord } from './TileCoord';
import { canStep, WalkClass, type WalkClassOf, WalkMode } from './walkRules';

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
  private readonly open = new MinHeap();
  /** Walk class of each tile reached in the current search, read once when it is first relaxed. */
  private readonly walkClass: Uint8Array;
  /** Walk classes of the 8 neighbours of the tile being expanded, in `STEP_DX`/`STEP_DY` order. */
  private readonly around = new Uint8Array(8);
  private readonly goals: PathGoals;
  private generation = 0;
  private expanded = 0;

  /** A path-finder for a `width` x `height` grid; allocates its search arrays once. */
  public constructor(private readonly width: number, private readonly height: number) {
    const size = width * height;
    this.cost = new Int32Array(size);
    this.parent = new Int32Array(size);
    this.seen = new Uint32Array(size);
    this.closed = new Uint32Array(size);
    this.walkClass = new Uint8Array(size);
    this.goals = new PathGoals(width, height);
  }

  /** Tiles expanded by the last `find`. */
  public get lastExpanded(): number {
    return this.expanded;
  }

  /**
   * The tiles to walk from `start` to the nearest reachable goal over the tiles `isWalkable` allows, on the ground
   * only; see `findWith`. For searches that do not know about the wall walk.
   */
  public find(
    start: TileCoord,
    goals: readonly TileCoord[],
    isWalkable: IsWalkable,
    maxExpanded: number = PATH_CONFIG.maxExpanded,
  ): TileCoord[] | null {
    const walkClassOf: WalkClassOf = (tx, ty) => (isWalkable(tx, ty) ? WalkClass.Ground : WalkClass.Blocked);
    return this.findWith(start, goals, walkClassOf, WalkMode.Ground, maxExpanded);
  }

  /**
   * The tiles to walk from `start` to the nearest reachable goal, excluding `start` and ending on that goal, taking
   * only steps `canStep` allows in `mode` between the classes `walkClassOf` gives; `[]` when `start` is a goal; null
   * when `goals` is empty, no goal is reachable or the search exceeds `maxExpanded` expansions. Repeated goals count
   * once. The start tile need not be walkable. Among equal f the larger cost so far comes first, then the smaller tile
   * index, so it is deterministic. `walkClassOf` is asked once per tile reached and once per neighbour looked at.
   */
  public findWith(
    start: TileCoord,
    goals: readonly TileCoord[],
    walkClassOf: WalkClassOf,
    mode: WalkMode,
    maxExpanded: number = PATH_CONFIG.maxExpanded,
  ): TileCoord[] | null {
    this.expanded = 0;
    if (!this.inGrid(start.tx, start.ty) || !this.goals.set(goals, ++this.generation)) return null;
    const gen = this.generation;
    const startIndex = start.ty * this.width + start.tx;
    this.open.clear();
    this.seen[startIndex] = gen;
    this.cost[startIndex] = 0;
    this.parent[startIndex] = -1;
    this.walkClass[startIndex] = walkClassOf(start.tx, start.ty);
    this.open.push(startIndex, this.goals.estimate(start.tx, start.ty));
    for (let index = this.open.pop(); index !== -1; index = this.open.pop()) {
      if (this.closed[index] === gen) continue;
      if (this.goals.has(index, gen)) return this.pathTo(index);
      if (this.expanded >= maxExpanded) return null;
      this.expanded++;
      this.closed[index] = gen;
      this.expand(index, walkClassOf, mode);
    }
    return null;
  }

  /** Relaxes every neighbour of `index` that the walk rules let it step to in `mode`. */
  private expand(index: number, walkClassOf: WalkClassOf, mode: WalkMode): void {
    const gen = this.generation;
    const x = index % this.width;
    const y = (index - x) / this.width;
    const around = this.around;
    for (let d = 0; d < 8; d++) {
      const nx = x + STEP_DX[d];
      const ny = y + STEP_DY[d];
      around[d] = this.inGrid(nx, ny) ? walkClassOf(nx, ny) : WalkClass.Blocked;
    }
    const from = this.walkClass[index] as WalkClass;
    for (let d = 0; d < 8; d++) {
      const dx = STEP_DX[d];
      const dy = STEP_DY[d];
      const diagonal = d >= 4;
      // The side tiles of a diagonal step are the straight steps (dx, 0) and (0, dy): indices 1/2 and 0/3.
      const sideA = around[dx < 0 ? 1 : 2] as WalkClass;
      const sideB = around[dy < 0 ? 0 : 3] as WalkClass;
      if (!canStep(from, around[d] as WalkClass, diagonal, sideA, sideB, mode)) continue;
      const nx = x + dx;
      const ny = y + dy;
      const next = ny * this.width + nx;
      if (this.closed[next] === gen) continue;
      const cost = this.cost[index] + (diagonal ? PATH_CONFIG.diagonalCost : PATH_CONFIG.straightCost);
      if (this.seen[next] === gen && cost >= this.cost[next]) continue;
      this.seen[next] = gen;
      this.cost[next] = cost;
      this.parent[next] = index;
      this.walkClass[next] = around[d];
      // Equal f: the larger cost so far (deeper node) first, then the smaller tile index.
      this.open.push(next, cost + this.goals.estimate(nx, ny), -cost);
    }
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
