// The camp's peasants: arrivals and leaving, jobs at production buildings, and their trips.
import { Arrivals } from './Arrivals';
import type { Economy } from './Economy';
import { Jobs } from './Jobs';
import type { MapObject } from './MapObject';
import { Peasant, type PeasantView } from './Peasant';
import { PeasantWalker } from './PeasantWalker';
import type { PopulationHost } from './PopulationHost';
import type { ProductionOutput, ProductionState } from './Production';
import type { TileCoord } from './TileCoord';
import { WorkerTrips } from './WorkerTrips';

export type { PopulationHost } from './PopulationHost';

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
  private readonly walker: PeasantWalker;
  private readonly trips: WorkerTrips;
  private nextId = 1;

  /** Peasants living in `world`, paying for arrivals from `economy` and delivering their work into it. */
  public constructor(world: PopulationHost, economy: Economy) {
    const isWalkable = (tx: number, ty: number): boolean => world.isWalkable(tx, ty);
    this.walker = new PeasantWalker(world.map.width, world.map.height, isWalkable);
    this.arrivals = new Arrivals(world, economy);
    this.trips = new WorkerTrips(world, economy, this.jobs, this.walker);
  }

  /** Number of peasants. */
  public get count(): number {
    return this.byId.size;
  }

  /** Peasants the standing buildings can house. */
  public get housing(): number {
    return this.arrivals.housing;
  }

  /** Number of peasants without anything to do. */
  public get idleCount(): number {
    let idle = 0;
    for (const p of this.byId.values()) if (p.state === 'idle') idle++;
    return idle;
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
    this.trips.buildingAdded(object);
  }

  /**
   * Call for every object removed from the world: the worker of a removed workplace goes idle where it stands
   * (its load lost), and peasants leave until the rest are housed.
   */
  public buildingRemoved(object: MapObject): void {
    this.arrivals.buildingRemoved(object);
    const worker = this.jobs.buildingRemoved(object);
    if (worker) this.trips.stop(worker);
    this.trips.buildingRemoved(object);
    this.leaveUntilHoused();
  }

  /** Advances one tick: arrivals and leaving, then job assignment, then every peasant's trip in ascending id order. */
  public tick(): void {
    const tile = this.arrivals.tick(this.byId.size);
    if (tile) {
      const peasant = new Peasant(this.nextId++, tile.tx, tile.ty);
      this.byId.set(peasant.id, peasant);
    }
    this.leaveUntilHoused();
    this.assignJobs();
    for (const p of this.byId.values()) this.trips.tick(p);
  }

  /** Whether the worker of building `buildingId` is at work there now. Production advances only then. */
  public isWorking(buildingId: number): boolean {
    return this.jobs.worker(buildingId)?.state === 'working';
  }

  /** Hands each finished batch to its building's worker, who carries it to storage. Call after production ticks. */
  public collect(outputs: readonly ProductionOutput[]): void {
    for (const { buildingId, resource, amount } of outputs) {
      const worker = this.jobs.worker(buildingId);
      if (worker) this.trips.carry(worker, { resource, amount });
    }
  }

  /** `own` (a building's production state) with the status its job adds; null stays null. */
  public withJobStatus(buildingId: number, own: ProductionState | null): ProductionState | null {
    return own && { ...own, status: this.jobs.status(buildingId, own.status) };
  }

  /** Ticks the building `buildingId` is still skipped by job assignment after a failed search; 0 when not skipped. */
  public jobSkipTicks(buildingId: number): number {
    return this.jobs.skipTicks(buildingId);
  }

  /**
   * Sends `peasant` toward the nearest of `goals` along a found path, from the tile it stands on (or, mid-step, the
   * tile it is stepping onto). Returns false, and leaves it without a walk, when no goal is reachable. For tests.
   */
  public walkTo(peasant: PeasantView, goals: readonly TileCoord[]): boolean {
    const p = this.byId.get(peasant.id);
    return p !== undefined && this.walker.walkTo(p, goals);
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
      this.jobs.release(p, false);
      this.byId.delete(p.id);
    }
  }
}
