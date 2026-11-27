// Moves walkers (peasants and units) along found paths, one timed step at a time. Deciding when to search again is the caller's job.
import { PathFinder } from './PathFinder';
import { PATH_CONFIG } from './pathConfig';
import { POPULATION_CONFIG } from './populationConfig';
import type { TileCoord } from './TileCoord';
import { canStep, WalkClass, type WalkClassOf, WalkMode } from './walkRules';
import type { Walker } from './Walker';

export class StepWalker {
  /** One path-finder for every search, so its arrays are allocated once per world. */
  private readonly pathFinder: PathFinder;

  /** Walks walkers on a `width` x `height` map whose tiles `walkClassOf` describes. */
  public constructor(width: number, height: number, private readonly walkClassOf: WalkClassOf) {
    this.pathFinder = new PathFinder(width, height);
  }

  /** A path from `start` to the nearest of `goals` over the classes `of` gives, in `mode`; see `PathFinder.findWith`. */
  public findPath(
    start: TileCoord,
    goals: readonly TileCoord[],
    of: WalkClassOf,
    mode: WalkMode = WalkMode.Ground,
    maxExpanded: number = PATH_CONFIG.maxExpanded,
  ): TileCoord[] | null {
    return this.pathFinder.findWith(start, goals, of, mode, maxExpanded);
  }

  /**
   * Gives `p` a walk toward the nearest of `goals` in `mode`, from the tile it stands on (or, mid-step, the tile it is
   * stepping onto). A ground walk that cannot start from a wall top (its stairs are gone) is searched again in `Down`
   * mode, so the peasant climbs down where it must. Returns false, and leaves it without a walk, when no goal is
   * reachable within `maxExpanded` tiles searched. `of` replaces the world's walk classes (raiders see gates as blocked).
   */
  public walkTo(
    p: Walker,
    goals: readonly TileCoord[],
    maxExpanded: number = PATH_CONFIG.maxExpanded,
    mode: WalkMode = WalkMode.Ground,
    of: WalkClassOf = this.walkClassOf,
  ): boolean {
    const start = { tx: p.nextTx, ty: p.nextTy };
    let used: WalkMode = mode;
    let path = this.pathFinder.findWith(start, goals, of, mode, maxExpanded);
    if (path === null && mode === WalkMode.Ground && of(start.tx, start.ty) === WalkClass.Top) {
      used = WalkMode.Down;
      path = this.pathFinder.findWith(start, goals, of, used, maxExpanded);
    }
    p.startWalk(path ?? [], used);
    return path !== null;
  }

  /**
   * True when `p` is between steps and the next step of its walk is no longer allowed (its tile built over since the
   * search, or the stair it climbed by gone), so it will not move until its walk is replaced. Check before `tick` to
   * search again in time.
   */
  public isNextStepBlocked(p: Walker, of: WalkClassOf = this.walkClassOf): boolean {
    if (p.stepTicks > 0 || p.pathIndex >= p.path.length) return false;
    const next = p.path[p.pathIndex];
    const diagonal = next.tx !== p.tx && next.ty !== p.ty;
    const allowed = canStep(of(p.tx, p.ty), of(next.tx, next.ty), diagonal, of(next.tx, p.ty), of(p.tx, next.ty), p.walkMode);
    return !allowed;
  }

  /** Advances `p`'s walk by one tick, starting its next step first when it is between steps and the way is open. */
  public tick(p: Walker, of: WalkClassOf = this.walkClassOf): void {
    if (p.stepTicks === 0 && !this.startStep(p, of)) return;
    p.advanceStep();
  }

  /** Starts the step onto the next tile of the walk. False when there is none, or it is no longer allowed. */
  private startStep(p: Walker, of: WalkClassOf): boolean {
    if (p.pathIndex >= p.path.length || this.isNextStepBlocked(p, of)) return false;
    const { tx, ty } = p.path[p.pathIndex];
    const diagonal = tx !== p.tx && ty !== p.ty;
    p.stepToNextTile(diagonal ? POPULATION_CONFIG.diagonalStepTicks : POPULATION_CONFIG.straightStepTicks);
    return true;
  }
}
