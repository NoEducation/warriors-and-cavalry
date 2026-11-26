// The camp's peasants: arrivals and leaving, jobs at production buildings, their trips and where idle ones wait.
import { Arrivals } from './Arrivals';
import type { Economy } from './Economy';
import { IdleStands } from './IdleStands';
import { Jobs } from './Jobs';
import type { MapObject } from './MapObject';
import { Peasant } from './Peasant';
import type { PeasantView } from './PeasantView';
import { PeasantWalker } from './PeasantWalker';
import type { PopulationHost } from './PopulationHost';
import type { ProductionOutput, ProductionState } from './Production';
import { StoragePlaces } from './StoragePlaces';
import { WoodcutterTrips } from './WoodcutterTrips';
import { WorkerTrips } from './WorkerTrips';

/** Population totals for the UI. */
export interface PopulationSummary {
  readonly count: number;
  readonly housing: number;
  readonly idle: number;
}

export class Population {
  /** Peasants by id; ids only increase, so insertion order is ascending id order. */
  private readonly byId = new Map<number, Peasant>();
  private readonly arrivals: Arrivals;
  private readonly jobs = new Jobs();
  private readonly stores: StoragePlaces;
  private readonly trips: WorkerTrips;
  private readonly woodcutters: WoodcutterTrips;
  private readonly stands: IdleStands;
  private nextId = 1;

  /** Peasants living in `world`, paying for arrivals from `economy` and delivering their work into it. */
  public constructor(world: PopulationHost, economy: Economy) {
    const isWalkable = (tx: number, ty: number): boolean => world.isWalkable(tx, ty);
    const walker = new PeasantWalker(world.map.width, world.map.height, isWalkable);
    this.arrivals = new Arrivals(world, economy);
    this.stores = new StoragePlaces(world);
    this.woodcutters = new WoodcutterTrips(world, walker);
    this.trips = new WorkerTrips(world, this.stores, economy, this.jobs, walker, this.woodcutters);
    this.stands = new IdleStands(world, walker, this.byId, () => this.arrivals.keep);
  }

  /** Number of peasants. */
  public get count(): number {
    return this.byId.size;
  }

  /** Peasants the standing buildings can house. */
  public get housing(): number {
    return this.arrivals.housing;
  }

  /** Number of peasants without anything to do: every peasant without a job. */
  public get idleCount(): number {
    return this.byId.size - this.jobs.filledCount;
  }

  /** Ticks counted toward the next arrival; 0 while nobody can arrive. */
  public get arrivalTimer(): number {
    return this.arrivals.arrivalTimer;
  }

  /** All peasants in ascending id order. */
  public peasants(): Iterable<PeasantView> {
    return this.byId.values();
  }

  /** Call for every object added to the world: counts its housing, opens its job, remembers a storage place. */
  public buildingAdded(object: MapObject): void {
    this.arrivals.buildingAdded(object);
    this.jobs.buildingAdded(object);
    this.stores.buildingAdded(object);
  }

  /**
   * Call for every object removed from the world: the worker of a removed workplace goes idle where it stands
   * (its load lost), and peasants leave until the rest are housed.
   */
  public buildingRemoved(object: MapObject): void {
    this.arrivals.buildingRemoved(object);
    const worker = this.jobs.buildingRemoved(object);
    if (worker) this.trips.stop(worker);
    this.stores.buildingRemoved(object);
    this.leaveUntilHoused();
  }

  /**
   * Advances one tick: arrivals and leaving, then job assignment, then every peasant in ascending id order (idle
   * ones at their stands, workers on their trips).
   */
  public tick(): void {
    const tile = this.arrivals.tick(this.byId.size);
    if (tile) {
      const peasant = new Peasant(this.nextId++, tile.tx, tile.ty);
      this.byId.set(peasant.id, peasant);
    }
    this.leaveUntilHoused();
    this.assignJobs();
    for (const p of this.byId.values()) {
      if (p.state === 'idle') this.stands.tick(p);
      else this.trips.tick(p);
    }
  }

  /**
   * Whether the worker of building `buildingId` is at work now: chopping its tree, or (any other worker) standing at
   * the building. Production advances only then.
   */
  public isWorking(buildingId: number): boolean {
    const worker = this.jobs.worker(buildingId);
    if (!worker) return false;
    return worker.state === 'chopping' || (worker.state === 'working' && !this.woodcutters.isWoodcutter(worker));
  }

  /**
   * Hands each finished batch to its building's worker, who carries it to storage. Call after production ticks.
   * Returns the trees felled by woodcutters whose batch this was, in the order of `outputs`, for the world to remove.
   */
  public collect(outputs: readonly ProductionOutput[]): number[] {
    const felled: number[] = [];
    for (const { buildingId, resource, amount } of outputs) {
      const worker = this.jobs.worker(buildingId);
      const tree = worker ? this.trips.carry(worker, { resource, amount }) : null;
      if (tree !== null) felled.push(tree);
    }
    return felled;
  }

  /**
   * `own` (a building's production state) with the status its job adds; null stays null. A building whose carrier
   * cannot reach any storage place for its load shows `workerCannotReach`; a woodcutter waiting at its hut for a
   * free tree shows `noTrees`.
   */
  public withJobStatus(buildingId: number, own: ProductionState | null): ProductionState | null {
    if (!own) return null;
    const worker = this.jobs.worker(buildingId);
    if (worker && this.trips.isStranded(worker)) return { ...own, status: 'workerCannotReach' };
    if (worker?.state === 'working' && this.woodcutters.isWoodcutter(worker)) return { ...own, status: 'noTrees' };
    return { ...own, status: this.jobs.status(buildingId, own.status) };
  }

  /** Ticks the building `buildingId` is still skipped by job assignment after a failed search; 0 when not skipped. */
  public jobSkipTicks(buildingId: number): number {
    return this.jobs.skipTicks(buildingId);
  }

  /** Each idle peasant, in ascending id order, takes the lowest-id vacant job that is not skipped. */
  private assignJobs(): void {
    this.jobs.tick();
    for (const p of this.byId.values()) {
      if (p.state !== 'idle') continue;
      const buildingId = this.jobs.vacant();
      if (buildingId === null) return;
      this.trips.startWork(p, buildingId);
    }
  }

  /** While there are more peasants than housing, removes idle ones by highest id first, then the rest likewise. */
  private leaveUntilHoused(): void {
    const excess = this.byId.size - this.arrivals.housing;
    if (excess <= 0) return;
    const newestFirst = [...this.byId.values()].reverse();
    const idle = newestFirst.filter((p) => p.state === 'idle');
    const idleFirst = [...idle, ...newestFirst.filter((p) => p.state !== 'idle')];
    for (const p of idleFirst.slice(0, excess)) {
      this.trips.stop(p); // frees its job and any tree it has claimed
      this.byId.delete(p.id);
    }
  }
}
