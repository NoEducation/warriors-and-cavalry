// Moves peasants along found paths, one timed step at a time. Deciding when to search again is the caller's job.
import type { Peasant } from './Peasant';
import { type IsWalkable, PathFinder } from './PathFinder';
import { PATH_CONFIG } from './pathConfig';
import { POPULATION_CONFIG } from './populationConfig';
import type { TileCoord } from './TileCoord';

export class PeasantWalker {
  /** One path-finder for every search, so its arrays are allocated once per world. */
  private readonly pathFinder: PathFinder;

  /** Walks peasants on a `width` x `height` map whose walkable tiles `isWalkable` tells. */
  public constructor(width: number, height: number, private readonly isWalkable: IsWalkable) {
    this.pathFinder = new PathFinder(width, height);
  }

  /**
   * Gives `p` a walk toward the nearest of `goals`, from the tile it stands on (or, mid-step, the tile it is stepping
   * onto). Returns false, and leaves it without a walk, when no goal is reachable within `maxExpanded` tiles searched.
   */
  public walkTo(p: Peasant, goals: readonly TileCoord[], maxExpanded: number = PATH_CONFIG.maxExpanded): boolean {
    const path = this.pathFinder.find({ tx: p.nextTx, ty: p.nextTy }, goals, this.isWalkable, maxExpanded);
    p.startWalk(path ?? []);
    return path !== null;
  }

  /**
   * True when `p` is between steps and the next tile of its walk is no longer walkable (built over since the search),
   * so it will not move until its walk is replaced. Check before `tick` to search again in time.
   */
  public isNextStepBlocked(p: Peasant): boolean {
    if (p.stepTicks > 0 || p.pathIndex >= p.path.length) return false;
    const next = p.path[p.pathIndex];
    return !this.isWalkable(next.tx, next.ty);
  }

  /** Advances `p`'s walk by one tick, starting its next step first when it is between steps and the way is open. */
  public tick(p: Peasant): void {
    if (p.stepTicks === 0 && !this.startStep(p)) return;
    p.advanceStep();
  }

  /** Starts the step onto the next tile of the walk. False when there is none, or it is no longer walkable. */
  private startStep(p: Peasant): boolean {
    if (p.pathIndex >= p.path.length || this.isNextStepBlocked(p)) return false;
    const { tx, ty } = p.path[p.pathIndex];
    const diagonal = tx !== p.tx && ty !== p.ty;
    p.stepToNextTile(diagonal ? POPULATION_CONFIG.diagonalStepTicks : POPULATION_CONFIG.straightStepTicks);
    return true;
  }
}
