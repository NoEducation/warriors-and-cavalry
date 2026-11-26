// The stumps felled trees leave: each counts down and is cleared away when its time is up.
import type { MapObject } from './MapObject';
import { ObjectKind } from './ObjectKind';
import { POPULATION_CONFIG } from './populationConfig';

export class Stumps {
  /** Ticks left per stump id; ids only increase, so insertion order is ascending id order. */
  private readonly left = new Map<number, number>();

  /** Call for every object added to the world: a stump starts its `stumpTicks` countdown. */
  public added(object: MapObject): void {
    if (object.kind === ObjectKind.Stump) this.left.set(object.id, POPULATION_CONFIG.stumpTicks);
  }

  /** Call for every object removed from the world: forgets a stump. */
  public removed(object: MapObject): void {
    this.left.delete(object.id);
  }

  /**
   * Counts every stump down by one tick, in ascending id order. Returns the ids of the stumps whose time is up, for
   * the caller to remove from the world.
   */
  public tick(): number[] {
    const expired: number[] = [];
    for (const [id, ticks] of this.left) {
      if (ticks <= 1) expired.push(id);
      else this.left.set(id, ticks - 1);
    }
    return expired;
  }

  /** Ticks before the stump `id` is cleared away; 0 when `id` is not a stump. */
  public ticksLeft(id: number): number {
    return this.left.get(id) ?? 0;
  }
}
