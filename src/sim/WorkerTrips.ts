// A worker's trips: walking to work, carrying each batch to the nearest storage place, and walking back.
import type { Economy } from './Economy';
import type { Jobs } from './Jobs';
import type { MapObject } from './MapObject';
import { OBJECT_KINDS, ObjectKind } from './ObjectKind';
import type { Load, Peasant } from './Peasant';
import type { PeasantWalker } from './PeasantWalker';
import type { PopulationHost } from './PopulationHost';
import { POPULATION_CONFIG } from './populationConfig';
import { RESOURCE_KINDS, type ResourceKind } from './ResourceKind';
import type { TileCoord } from './TileCoord';

/** True when a building of `kind` takes deliveries of `resource`: the Keep takes all, other stores what they hold. */
function storesResource(kind: ObjectKind, resource: ResourceKind): boolean {
  return kind === ObjectKind.Keep || OBJECT_KINDS[kind].storage[resource] > 0;
}

export class WorkerTrips {
  /** Standing storage places (Keeps, Stockpiles, Granaries) by id (ascending). */
  private readonly stores = new Map<number, MapObject>();

  /** Trips in `world`, delivering into `economy`; `jobs` is told when a worker gives its job up. */
  public constructor(
    private readonly world: PopulationHost,
    private readonly economy: Economy,
    private readonly jobs: Jobs,
    private readonly walker: PeasantWalker,
  ) {}

  /** Call for every object added to the world: remembers storage places. */
  public buildingAdded(object: MapObject): void {
    if (RESOURCE_KINDS.some((resource) => storesResource(object.kind, resource))) this.stores.set(object.id, object);
  }

  /** Call for every object removed from the world: forgets a storage place (its carriers re-target on their tick). */
  public buildingRemoved(object: MapObject): void {
    this.stores.delete(object.id);
  }

  /** Gives `peasant` the vacant job at `buildingId` and sends it there; with no path it gives the job up. */
  public startWork(peasant: Peasant, buildingId: number): void {
    this.jobs.take(buildingId, peasant);
    peasant.state = 'toWork';
    this.plan(peasant);
  }

  /** Hands the working `peasant` its building's finished batch and sends it to the nearest storage place for it. */
  public carry(peasant: Peasant, load: Load): void {
    peasant.load = load;
    peasant.state = 'toStore';
    this.plan(peasant);
  }

  /** Makes `peasant` idle where it stands, dropping its load. Its job must already be freed. */
  public stop(peasant: Peasant): void {
    peasant.state = 'idle';
    peasant.load = null;
    peasant.targetId = null;
    peasant.waitTicks = 0;
    peasant.setWalk([], []);
  }

  /** Advances `peasant` by one tick: waiting, re-routing, one tick of walking, then what it does on arrival. */
  public tick(p: Peasant): void {
    if (p.waitTicks > 0) {
      if (--p.waitTicks > 0) return;
      this.plan(p);
    } else if (p.state === 'toStore' && (p.targetId === null || !this.stores.has(p.targetId))) {
      this.plan(p);
    } else if (p.state !== 'idle' && p.stepTicks === 0 && p.pathIndex < p.path.length) {
      const next = p.path[p.pathIndex];
      if (!this.world.isWalkable(next.tx, next.ty)) this.plan(p);
    }
    this.walker.tick(p);
    if (p.stepTicks === 0 && p.pathIndex >= p.path.length && p.waitTicks === 0) this.arrive(p);
  }

  /** At the end of a walk: starts working or delivers when at the goal building, otherwise searches again. */
  private arrive(p: Peasant): void {
    if (p.state === 'toWork' || p.state === 'toWorkBack') {
      if (this.isAt(p, p.workplaceId)) p.state = 'working';
      else this.plan(p);
    } else if (p.state === 'toStore') {
      if (this.isAt(p, p.targetId)) this.deliver(p);
      else this.plan(p);
    }
  }

  /** Stores the load (what does not fit is lost) and heads back to work. */
  private deliver(p: Peasant): void {
    if (p.load) this.economy.add(p.load.resource, p.load.amount);
    p.load = null;
    p.targetId = null;
    p.state = 'toWorkBack';
    this.plan(p);
  }

  /**
   * Searches from where `p` stands toward its goal building, working the goal tiles out again. A worker with no way
   * to its workplace gives the job up (skipped) and goes idle; a carrier with no storage place in reach waits.
   */
  private plan(p: Peasant): void {
    if (p.state === 'toStore') {
      this.planDelivery(p);
      return;
    }
    if (p.workplaceId !== null && this.walker.walkTo(p, this.world.accessTiles(p.workplaceId))) return;
    this.jobs.release(p, true);
    this.stop(p);
  }

  /** One search toward every storage place for the load; the target is the one whose access tile the path ends on. */
  private planDelivery(p: Peasant): void {
    const candidates: [number, TileCoord[]][] = [];
    const goals: TileCoord[] = [];
    for (const store of this.stores.values()) {
      if (!p.load || !storesResource(store.kind, p.load.resource)) continue;
      const tiles = this.world.accessTiles(store.id);
      candidates.push([store.id, tiles]);
      goals.push(...tiles);
    }
    p.targetId = null;
    if (!this.walker.walkTo(p, goals)) {
      p.waitTicks = POPULATION_CONFIG.retryTicks;
      return;
    }
    const end = p.path.length > 0 ? p.path[p.path.length - 1] : { tx: p.nextTx, ty: p.nextTy };
    const target = candidates.find(([, tiles]) => tiles.some((t) => t.tx === end.tx && t.ty === end.ty));
    p.targetId = target ? target[0] : null;
  }

  /** True when `p` stands on an access tile of the building `objectId`. */
  private isAt(p: Peasant, objectId: number | null): boolean {
    if (objectId === null) return false;
    return this.world.accessTiles(objectId).some((t) => t.tx === p.tx && t.ty === p.ty);
  }
}
