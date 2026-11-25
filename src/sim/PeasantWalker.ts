// Moves peasants along found paths, one timed step at a time, searching again when the way is built over.
import type { Peasant } from './Peasant';
import { type IsWalkable, PathFinder } from './PathFinder';
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
   * onto). Returns false, and leaves it without a walk, when no goal is reachable.
   */
  public walkTo(p: Peasant, goals: readonly TileCoord[]): boolean {
    const path = this.pathFinder.find({ tx: p.nextTx, ty: p.nextTy }, goals, this.isWalkable);
    p.setWalk(path ?? [], path ? goals : []);
    return path !== null;
  }

  /** Advances `p`'s walk by one tick, starting its next step first when it is between steps. */
  public tick(p: Peasant): void {
    if (p.stepTicks === 0 && !this.startStep(p)) return;
    p.advanceStep();
  }

  /**
   * Starts the step onto the next tile of the walk; when that tile is no longer walkable, searches again from here
   * toward the same goals first. False when there is no step to take.
   */
  private startStep(p: Peasant): boolean {
    if (p.pathIndex >= p.path.length) return false;
    let next = p.path[p.pathIndex];
    if (!this.isWalkable(next.tx, next.ty)) {
      if (!this.walkTo(p, p.goals) || p.path.length === 0) return false;
      next = p.path[0];
    }
    p.pathIndex++;
    const diagonal = next.tx !== p.tx && next.ty !== p.ty;
    p.startStep(next.tx, next.ty, diagonal ? POPULATION_CONFIG.diagonalStepTicks : POPULATION_CONFIG.straightStepTicks);
    return true;
  }
}
