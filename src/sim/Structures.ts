// The hit points of every standing building that can be attacked.
import type { MapObject } from './MapObject';
import { OBJECT_KINDS } from './ObjectKind';

/** A building's current and full hit points. */
export interface HitPoints {
  readonly current: number;
  readonly max: number;
}

export class Structures {
  /** Current hit points by object id; ids only increase, so insertion order is ascending id order. */
  private readonly current = new Map<number, number>();
  private readonly kinds = new Map<number, MapObject['kind']>();

  /** Call for every object added to the world: an attackable building starts at its full hit points. */
  public added(object: MapObject): void {
    const max = OBJECT_KINDS[object.kind].hitPoints;
    if (max === 0) return;
    this.current.set(object.id, max);
    this.kinds.set(object.id, object.kind);
  }

  /** Call for every object removed from the world. */
  public removed(object: MapObject): void {
    this.current.delete(object.id);
    this.kinds.delete(object.id);
  }

  /** The building `id`'s hit points; null when it is not a standing attackable building. */
  public hitPoints(id: number): HitPoints | null {
    const current = this.current.get(id);
    const kind = this.kinds.get(id);
    if (current === undefined || kind === undefined) return null;
    return { current, max: OBJECT_KINDS[kind].hitPoints };
  }

  /** True when `id` is a standing building that can be attacked. */
  public has(id: number): boolean {
    return this.current.has(id);
  }

  /**
   * Takes `amount` hit points from building `id` (not below 0). Returns true when it has just fallen to 0, for the
   * caller to remove it. Unknown ids change nothing.
   */
  public damage(id: number, amount: number): boolean {
    const current = this.current.get(id);
    if (current === undefined || current <= 0) return false;
    const left = Math.max(0, current - amount);
    this.current.set(id, left);
    return left === 0;
  }

  /** Each damaged building (below its full hit points) as [id, hit points], in ascending id order. */
  public *damaged(): Iterable<readonly [number, number]> {
    for (const [id, hp] of this.current) {
      const kind = this.kinds.get(id);
      if (kind !== undefined && hp < OBJECT_KINDS[kind].hitPoints) yield [id, hp];
    }
  }
}
