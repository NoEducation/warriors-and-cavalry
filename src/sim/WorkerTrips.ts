// A worker's trips: walking to work, carrying each batch to the nearest storage place, and walking back.
import type { Economy } from './Economy';
import type { Jobs } from './Jobs';
import type { MapObject } from './MapObject';
import type { Peasant } from './Peasant';
import type { PeasantWalker } from './PeasantWalker';
import type { Load } from './PeasantView';
import type { PopulationHost } from './PopulationHost';
import { POPULATION_CONFIG } from './populationConfig';
import { StoragePlaces } from './StoragePlaces';
import type { TileCoord } from './TileCoord';

export class WorkerTrips {
  private readonly stores: StoragePlaces;

  /** Trips in `world`, delivering into `economy`; `jobs` is told when a worker gives its job up. */
  public constructor(
    private readonly world: PopulationHost,
    private readonly economy: Economy,
    private readonly jobs: Jobs,
    private readonly walker: PeasantWalker,
  ) {
    this.stores = new StoragePlaces(world);
  }

  /** Call for every object added to the world: remembers storage places. */
  public buildingAdded(object: MapObject): void {
    this.stores.buildingAdded(object);
  }

  /** Call for every object removed from the world: forgets a storage place (its carriers re-target on their tick). */
  public buildingRemoved(object: MapObject): void {
    this.stores.buildingRemoved(object);
  }

  /** Gives the idle `p` the vacant job at `buildingId` and sends it there; with no path it gives the job up. */
  public startWork(p: Peasant, buildingId: number): void {
    this.jobs.take(buildingId, p);
    if (!this.planWorkWalk(p)) this.giveUpJob(p);
  }

  /** Hands the working `p` its building's finished batch and sends it to the nearest storage place for it. */
  public carry(p: Peasant, load: Load): void {
    p.pickUp(load);
    this.planDelivery(p);
  }

  /** Makes `p` idle where it stands, dropping its load and freeing its job; fine when its workplace is already gone. */
  public stop(p: Peasant): void {
    this.jobs.release(p, false);
    p.goIdle();
  }

  /** Advances `p` by one tick of what its state has it do. Call once per tick per peasant, in ascending id order. */
  public tick(p: Peasant): void {
    switch (p.state) {
      case 'idle':
        this.walker.tick(p); // only finishes a step under way
        break;
      case 'toWork':
      case 'toWorkBack':
        this.tickToWork(p);
        break;
      case 'working':
        break; // stands at work; production hands it each finished batch (see `carry`)
      case 'toStore':
        this.tickToStore(p);
        break;
    }
  }

  /** Walking to work (first or after a delivery): re-routes when blocked, starts working on arrival. */
  private tickToWork(p: Peasant): void {
    if (this.needsNewPath(p) && !this.planWorkWalk(p)) {
      this.giveUpJob(p);
      return;
    }
    this.walker.tick(p);
    if (!this.isWalkDone(p)) return;
    if (this.isAt(p, p.workplaceId)) p.startWorking();
    else if (!this.planWorkWalk(p)) this.giveUpJob(p);
  }

  /** Carrying a load: waits out a failed search, re-routes when needed, delivers on arrival. */
  private tickToStore(p: Peasant): void {
    if (p.waitTicks > 0) {
      if (!p.countDownWait()) return;
      this.planDelivery(p);
    } else if (this.needsNewPath(p)) {
      this.planDelivery(p);
    }
    this.walker.tick(p);
    if (!this.isWalkDone(p)) return;
    if (this.isAt(p, p.targetId)) this.deliverLoad(p);
    else this.planDelivery(p);
  }

  /** Stores `p`'s load (what does not fit is lost) and sends it back to work. */
  private deliverLoad(p: Peasant): void {
    const load = p.deliver();
    if (load) this.economy.add(load.resource, load.amount);
    if (!this.planWorkWalk(p)) this.giveUpJob(p);
  }

  /** Frees `p`'s job, skipping its building for a while, and makes it idle where it stands. */
  private giveUpJob(p: Peasant): void {
    this.jobs.release(p, true);
    p.goIdle();
  }

  /** True when `p`'s walk is no good any more: its delivery target is gone, or the next tile was built over. */
  private needsNewPath(p: Peasant): boolean {
    if (p.state === 'toStore' && !this.stores.has(p.targetId)) return true;
    if (p.stepTicks > 0 || p.pathIndex >= p.path.length) return false;
    const next = p.path[p.pathIndex];
    return !this.world.isWalkable(next.tx, next.ty);
  }

  /** True when `p` stands at the end of its walk (no step under way, no tile left) and is not waiting to search. */
  private isWalkDone(p: Peasant): boolean {
    return p.stepTicks === 0 && p.pathIndex >= p.path.length && p.waitTicks === 0;
  }

  /** Searches from where `p` stands toward its workplace's access tiles; false when there is no way there. */
  private planWorkWalk(p: Peasant): boolean {
    return p.workplaceId !== null && this.walker.walkTo(p, this.world.accessTiles(p.workplaceId));
  }

  /**
   * One search toward every storage place for `p`'s load; the target is the one whose access tile the path ends on.
   * With none in reach, `p` waits where it is and searches again later.
   */
  private planDelivery(p: Peasant): void {
    const candidates = p.load ? this.stores.candidatesFor(p.load.resource) : [];
    const goals: TileCoord[] = [];
    for (const candidate of candidates) goals.push(...candidate.tiles);
    p.setTarget(null);
    if (!this.walker.walkTo(p, goals)) {
      p.wait(POPULATION_CONFIG.retryTicks);
      return;
    }
    const end = p.path.length > 0 ? p.path[p.path.length - 1] : { tx: p.nextTx, ty: p.nextTy };
    const target = candidates.find(({ tiles }) => tiles.some((t) => t.tx === end.tx && t.ty === end.ty));
    p.setTarget(target ? target.id : null);
  }

  /** True when `p` stands on an access tile of the building `objectId`. */
  private isAt(p: Peasant, objectId: number | null): boolean {
    if (objectId === null) return false;
    return this.world.accessTiles(objectId).some((t) => t.tx === p.tx && t.ty === p.ty);
  }
}
