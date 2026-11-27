// Production jobs: which worker works at each producing building, and which buildings are skipped for a while.
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
  /** Jobs that have a worker. */
  private filled = 0;

  /** Number of jobs that have a worker. */
  public get filledCount(): number {
    return this.filled;
  }

  /** Call for every object added to the world: a producing building gets a vacant job. */
  public buildingAdded(object: MapObject): void {
    if (OBJECT_KINDS[object.kind].production) this.workers.set(object.id, null);
  }

  /**
   * Call for every object removed from the world: forgets its job and returns its worker, if it had one, for the
   * caller to remove.
   */
  public buildingRemoved(object: MapObject): Peasant | null {
    const worker = this.workers.get(object.id) ?? null;
    this.workers.delete(object.id);
    this.skipped.delete(object.id);
    if (worker) this.filled--;
    return worker;
  }

  /** Counts every skipped building down by one tick; a building whose count reaches 0 is offered again. */
  public tick(): void {
    for (const [id, left] of this.skipped) {
      if (left <= 1) this.skipped.delete(id);
      else this.skipped.set(id, left - 1);
    }
  }

  /** The buildings with no worker that are not skipped, in ascending id order. */
  public vacancies(): number[] {
    const ids: number[] = [];
    for (const [id, worker] of this.workers) if (worker === null && !this.skipped.has(id)) ids.push(id);
    return ids;
  }

  /** Gives the vacant job at its workplace to the new worker `peasant`. */
  public take(peasant: Peasant): void {
    this.workers.set(peasant.workplaceId, peasant);
    this.filled++;
  }

  /** Skips the vacant building `buildingId` for `unreachableSkipTicks`: no worker could reach it from the Keep. */
  public skip(buildingId: number): void {
    this.skipped.set(buildingId, POPULATION_CONFIG.unreachableSkipTicks);
  }

  /** Frees the job of the worker `peasant`, if its workplace still stands. Call when it is removed. */
  public release(peasant: Peasant): void {
    const id = peasant.workplaceId;
    if (this.workers.get(id) !== peasant) return;
    this.workers.set(id, null);
    this.filled--;
  }

  /** The peasant working at `buildingId`, or null. */
  public worker(buildingId: number): Peasant | null {
    return this.workers.get(buildingId) ?? null;
  }

  /** Ticks `buildingId` stays skipped by worker spawning; 0 when it is not skipped. */
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
