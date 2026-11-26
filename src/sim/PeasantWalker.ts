// Moves peasants along found paths, one timed step at a time. Deciding when to search again is the caller's job.
import type { Peasant } from './Peasant';
import { PathFinder } from './PathFinder';
import { PATH_CONFIG } from './pathConfig';
import { POPULATION_CONFIG } from './populationConfig';
import type { TileCoord } from './TileCoord';
import { canStep, WalkClass, type WalkClassOf, WalkMode } from './walkRules';

export class PeasantWalker {
  /** One path-finder for every search, so its arrays are allocated once per world. */
  private readonly pathFinder: PathFinder;

  /** Walks peasants on a `width` x `height` map whose tiles `walkClassOf` describes. */
  public constructor(width: number, height: number, private readonly walkClassOf: WalkClassOf) {
    this.pathFinder = new PathFinder(width, height);
  }

  /**
   * Gives `p` a walk toward the nearest of `goals` in `mode`, from the tile it stands on (or, mid-step, the tile it is
   * stepping onto). A ground walk that cannot start from a wall top (its stairs are gone) is searched again in `Down`
   * mode, so the peasant climbs down where it must. Returns false, and leaves it without a walk, when no goal is
   * reachable within `maxExpanded` tiles searched.
   */
  public walkTo(
    p: Peasant,
    goals: readonly TileCoord[],
    maxExpanded: number = PATH_CONFIG.maxExpanded,
    mode: WalkMode = WalkMode.Ground,
  ): boolean {
    const start = { tx: p.nextTx, ty: p.nextTy };
    let used: WalkMode = mode;
    let path = this.pathFinder.findWith(start, goals, this.walkClassOf, mode, maxExpanded);
    if (path === null && mode === WalkMode.Ground && this.walkClassOf(start.tx, start.ty) === WalkClass.Top) {
      used = WalkMode.Down;
      path = this.pathFinder.findWith(start, goals, this.walkClassOf, used, maxExpanded);
    }
    p.startWalk(path ?? [], used);
    return path !== null;
  }

  /**
   * True when `p` is between steps and the next step of its walk is no longer allowed (its tile built over since the
   * search, or the stair it climbed by gone), so it will not move until its walk is replaced. Check before `tick` to
   * search again in time.
   */
  public isNextStepBlocked(p: Peasant): boolean {
    if (p.stepTicks > 0 || p.pathIndex >= p.path.length) return false;
    const next = p.path[p.pathIndex];
    const of = this.walkClassOf;
    const diagonal = next.tx !== p.tx && next.ty !== p.ty;
    const allowed = canStep(of(p.tx, p.ty), of(next.tx, next.ty), diagonal, of(next.tx, p.ty), of(p.tx, next.ty), p.walkMode);
    return !allowed;
  }

  /** Advances `p`'s walk by one tick, starting its next step first when it is between steps and the way is open. */
  public tick(p: Peasant): void {
    if (p.stepTicks === 0 && !this.startStep(p)) return;
    p.advanceStep();
  }

  /** Starts the step onto the next tile of the walk. False when there is none, or it is no longer allowed. */
  private startStep(p: Peasant): boolean {
    if (p.pathIndex >= p.path.length || this.isNextStepBlocked(p)) return false;
    const { tx, ty } = p.path[p.pathIndex];
    const diagonal = tx !== p.tx && ty !== p.ty;
    p.stepToNextTile(diagonal ? POPULATION_CONFIG.diagonalStepTicks : POPULATION_CONFIG.straightStepTicks);
    return true;
  }
}
