// Production jobs: which peasant works at each producing building, and which buildings are skipped for a while.
import type { MapObject } from './MapObject';
import { OBJECT_KINDS } from './ObjectKind';
import type { Peasant } from './Peasant';
import { POPULATION_CONFIG } from './populationConfig';
import type { ProductionStatus } from './Production';

export class Jobs {
  /** Producing buildings by id (ascending), each with its worker or null when vacant. */
  private readonly workers = new Map<number, Peasant | null>();
  /** Ticks each skipped building stays skipped, by building id. */
  private readonly skipped = new Map<number, number>();

  /** Call for every object added to the world: a producing building gets a vacant job. */
  public buildingAdded(object: MapObject): void {
    if (OBJECT_KINDS[object.kind].production) this.workers.set(object.id, null);
  }

  /** Call for every object removed from the world: forgets its job and returns its worker, if it had one. */
  public buildingRemoved(object: MapObject): Peasant | null {
    const worker = this.workers.get(object.id) ?? null;
    this.workers.delete(object.id);
    this.skipped.delete(object.id);
    if (worker) worker.workplaceId = null;
    return worker;
  }

  /** Counts every skipped building down by one tick; a building whose count reaches 0 is offered again. */
  public tick(): void {
    for (const [id, left] of this.skipped) {
      if (left <= 1) this.skipped.delete(id);
      else this.skipped.set(id, left - 1);
    }
  }

  /** The lowest-id building with no worker that is not skipped, or null when there is none. */
  public vacant(): number | null {
    for (const [id, worker] of this.workers) if (worker === null && !this.skipped.has(id)) return id;
    return null;
  }

  /** Gives the vacant job at `buildingId` to `peasant`. */
  public take(buildingId: number, peasant: Peasant): void {
    this.workers.set(buildingId, peasant);
    peasant.workplaceId = buildingId;
  }

  /** Frees `peasant`'s job, if it has one; with `skip`, the building is skipped for `unreachableSkipTicks`. */
  public release(peasant: Peasant, skip: boolean): void {
    const id = peasant.workplaceId;
    if (id === null) return;
    peasant.workplaceId = null;
    if (!this.workers.has(id)) return;
    this.workers.set(id, null);
    if (skip) this.skipped.set(id, POPULATION_CONFIG.unreachableSkipTicks);
  }

  /** The peasant working at `buildingId`, or null. */
  public worker(buildingId: number): Peasant | null {
    return this.workers.get(buildingId) ?? null;
  }

  /** Ticks `buildingId` stays skipped by job assignment; 0 when it is not skipped. */
  public skipTicks(buildingId: number): number {
    return this.skipped.get(buildingId) ?? 0;
  }

  /**
   * What `buildingId` shows, given its own production status `own`: `noWorker`, `workerCannotReach` while skipped,
   * `workerOnTheWay` on the first walk to work, `workerDelivering` while the worker is away, otherwise `own`.
   */
  public status(buildingId: number, own: ProductionStatus): ProductionStatus {
    const worker = this.worker(buildingId);
    if (!worker) return this.skipped.has(buildingId) ? 'workerCannotReach' : 'noWorker';
    if (worker.state === 'toWork') return 'workerOnTheWay';
    if (worker.state === 'toStore' || worker.state === 'toWorkBack') return 'workerDelivering';
    return own;
  }
}
