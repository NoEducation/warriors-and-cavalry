// The Barracks: their training queues and the soldier room they give.
import { COMBAT_CONFIG } from './combatConfig';
import type { MapObject } from './MapObject';
import { OBJECT_KINDS } from './ObjectKind';
import { type UnitKind, UNIT_KINDS } from './UnitKind';

/** What a Barracks is training: the queued kinds, front first, and the ticks done on the front one. */
export interface TrainingQueueView {
  readonly kinds: readonly UnitKind[];
  readonly progress: number;
}

/** One Barracks' queue. */
interface Queue {
  readonly barracks: MapObject;
  readonly kinds: UnitKind[];
  progress: number;
}

/** Steps a finished soldier of `kind` out of `barracks`; false when it cannot (no free access tile). */
export type SoldierExit = (barracks: MapObject, kind: UnitKind) => boolean;

export class Training {
  /** Queues by Barracks id; ids only increase, so insertion order is ascending id order. */
  private readonly queues = new Map<number, Queue>();
  private totalRoom = 0;

  /** Soldiers the player may have, trained and queued: the room the standing Barracks give. */
  public get room(): number {
    return this.totalRoom;
  }

  /** Soldiers waiting in every queue. */
  public get queued(): number {
    let count = 0;
    for (const queue of this.queues.values()) count += queue.kinds.length;
    return count;
  }

  /** True when `objectId` is a standing Barracks. */
  public isBarracks(objectId: number): boolean {
    return this.queues.has(objectId);
  }

  /** The queue of Barracks `objectId`; null when it is not a standing Barracks. */
  public queue(objectId: number): TrainingQueueView | null {
    const queue = this.queues.get(objectId);
    return queue ? { kinds: [...queue.kinds], progress: queue.progress } : null;
  }

  /** Every standing Barracks' queue in ascending Barracks id order, as [id, queue]; for the checksum. */
  public *all(): Iterable<readonly [number, TrainingQueueView]> {
    for (const [id, queue] of this.queues) yield [id, queue];
  }

  /** Call for every object added to the world: a Barracks gets an empty queue and adds its room. */
  public buildingAdded(object: MapObject): void {
    const { soldierRoom } = OBJECT_KINDS[object.kind];
    if (soldierRoom === 0) return;
    this.queues.set(object.id, { barracks: object, kinds: [], progress: 0 });
    this.totalRoom += soldierRoom;
  }

  /** Call for every object removed from the world: a Barracks' queue is lost (nothing is refunded). */
  public buildingRemoved(object: MapObject): void {
    if (this.queues.delete(object.id)) this.totalRoom -= OBJECT_KINDS[object.kind].soldierRoom;
  }

  /** True when Barracks `objectId` has room for one more in its queue. */
  public hasQueueRoom(objectId: number): boolean {
    const queue = this.queues.get(objectId);
    return queue !== undefined && queue.kinds.length < COMBAT_CONFIG.queueLimit;
  }

  /** Adds `kind` to the back of Barracks `objectId`'s queue (paid for already); returns the queue's new length. */
  public enqueue(objectId: number, kind: UnitKind): number {
    const queue = this.queues.get(objectId);
    if (!queue) throw new RangeError(`no Barracks ${objectId}`);
    queue.kinds.push(kind);
    return queue.kinds.length;
  }

  /**
   * Advances every queue's front soldier by one tick, in ascending Barracks id order; a finished one steps out through
   * `exit`, or keeps its full progress and its place until `exit` lets it out.
   */
  public tick(exit: SoldierExit): void {
    for (const queue of this.queues.values()) {
      const front = queue.kinds[0];
      if (front === undefined) continue;
      const needed = UNIT_KINDS[front].trainTicks;
      if (queue.progress < needed) queue.progress++;
      if (queue.progress < needed || !exit(queue.barracks, front)) continue;
      queue.kinds.shift();
      queue.progress = 0;
    }
  }
}
