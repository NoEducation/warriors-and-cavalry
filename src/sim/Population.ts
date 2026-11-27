// The workers: one spawned at the Keep for each production building while the housing has room, their trips, and
// their deaths with their building or when the housing drops below them. Nobody waits idle; nobody eats.
import type { Economy } from './Economy';
import { Housing } from './Housing';
import { Jobs } from './Jobs';
import type { MapObject } from './MapObject';
import { Peasant } from './Peasant';
import type { PeasantView } from './PeasantView';
import { StepWalker } from './StepWalker';
import type { PopulationHost } from './PopulationHost';
import type { ProductionOutput, ProductionState } from './Production';
import { StoragePlaces } from './StoragePlaces';
import { WoodcutterTrips } from './WoodcutterTrips';
import type { WalkClass } from './walkRules';
import { WorkerTrips } from './WorkerTrips';

/** Population totals for the UI: workers, and the worker limit the homes give. */
export interface PopulationSummary {
  readonly count: number;
  readonly housing: number;
}

export class Population {
  /** Workers by id; ids only increase, so insertion order is ascending id order. */
  private readonly byId = new Map<number, Peasant>();
  private readonly housingOf: Housing;
  private readonly jobs = new Jobs();
  private readonly stores: StoragePlaces;
  private readonly trips: WorkerTrips;
  private readonly woodcutters: WoodcutterTrips;
  private nextId = 1;

  /** Workers living in `world`, delivering their work into `economy`. */
  public constructor(world: PopulationHost, economy: Economy) {
    const walkClass = (tx: number, ty: number): WalkClass => world.walkClass(tx, ty);
    const walker = new StepWalker(world.map.width, world.map.height, walkClass);
    this.housingOf = new Housing(world);
    this.stores = new StoragePlaces(world);
    this.woodcutters = new WoodcutterTrips(world, walker);
    this.trips = new WorkerTrips(world, this.stores, economy, this.jobs, walker, this.woodcutters);
  }

  /** Number of workers. */
  public get count(): number {
    return this.byId.size;
  }

  /** The worker limit: peasants the standing buildings house. */
  public get housing(): number {
    return this.housingOf.housing;
  }

  /** All workers in ascending id order. */
  public peasants(): Iterable<PeasantView> {
    return this.byId.values();
  }

  /** The worker `id`, or undefined. */
  public peasantById(id: number): PeasantView | undefined {
    return this.byId.get(id);
  }

  /** Takes `amount` hit points from worker `id` (a raider's strike); unknown ids change nothing. */
  public damage(id: number, amount: number): void {
    this.byId.get(id)?.takeDamage(amount);
  }

  /** Removes the workers killed this tick, in ascending id order; their buildings get new workers when there is room. */
  public removeDead(): void {
    for (const p of [...this.byId.values()]) if (p.hitPoints <= 0) this.remove(p);
  }

  /** Call for every object added to the world: counts its housing, opens its job, remembers a storage place. */
  public buildingAdded(object: MapObject): void {
    this.housingOf.buildingAdded(object);
    this.jobs.buildingAdded(object);
    this.stores.buildingAdded(object);
  }

  /**
   * Call for every object removed from the world: the worker of a removed workplace dies (its load lost), then the
   * newest workers die until the rest fit the housing.
   */
  public buildingRemoved(object: MapObject): void {
    this.housingOf.buildingRemoved(object);
    const worker = this.jobs.buildingRemoved(object);
    if (worker) this.remove(worker);
    this.stores.buildingRemoved(object);
    this.dieUntilHoused();
  }

  /** Advances one tick: workers spawn for the vacant jobs, then every worker in ascending id order walks or works. */
  public tick(): void {
    this.spawnWorkers();
    for (const p of this.byId.values()) this.trips.tick(p);
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
   * `own` (a building's production state) with the status its job adds; null stays null. A building whose worker
   * cannot reach its way shows `workerCannotReach`; a woodcutter waiting at its hut for a free tree shows `noTrees`.
   */
  public withJobStatus(buildingId: number, own: ProductionState | null): ProductionState | null {
    if (!own) return null;
    const worker = this.jobs.worker(buildingId);
    if (worker && this.trips.isStranded(worker)) return { ...own, status: 'workerCannotReach' };
    if (worker?.state === 'working' && this.woodcutters.isWoodcutter(worker)) return { ...own, status: 'noTrees' };
    return { ...own, status: this.jobs.status(buildingId, own.status) };
  }

  /** Ticks the building `buildingId` is still skipped by worker spawning after a failed search; 0 when not skipped. */
  public jobSkipTicks(buildingId: number): number {
    return this.jobs.skipTicks(buildingId);
  }

  /**
   * While the housing has room, each vacant building that is not skipped, in ascending id order, gets a new worker on
   * the Keep's spawn tile, walking to it. A building with no way there from the Keep, or with every tile around the
   * Keep built over, is skipped instead (`workerCannotReach`).
   */
  private spawnWorkers(): void {
    this.jobs.tick();
    for (const buildingId of this.jobs.vacancies()) {
      if (this.byId.size >= this.housingOf.housing) return;
      const tile = this.housingOf.spawnTile();
      if (!tile && !this.housingOf.keep) return; // no Keep: buildings wait as `noWorker`
      const worker = tile ? new Peasant(this.nextId, tile.tx, tile.ty, buildingId) : null;
      if (!worker || !this.trips.startWork(worker)) {
        this.jobs.skip(buildingId);
        continue;
      }
      this.nextId++;
      this.jobs.take(worker);
      this.byId.set(worker.id, worker);
    }
  }

  /** While there are more workers than housing, the newest (highest id) die. */
  private dieUntilHoused(): void {
    const excess = this.byId.size - this.housingOf.housing;
    if (excess <= 0) return;
    for (const p of [...this.byId.values()].reverse().slice(0, excess)) this.remove(p);
  }

  /** Removes the worker `p`: frees its job and any tree it has claimed; its load is lost. */
  private remove(p: Peasant): void {
    this.trips.dismiss(p);
    this.byId.delete(p.id);
  }
}
