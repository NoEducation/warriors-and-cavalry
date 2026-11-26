// A worker's trips: walking to work, carrying each batch to the nearest storage place, and walking back; a
// woodcutter's walks to its trees are `WoodcutterTrips`' part.
import type { Economy } from './Economy';
import type { Jobs } from './Jobs';

import type { Peasant } from './Peasant';
import type { PeasantWalker } from './PeasantWalker';
import type { Load } from './PeasantView';
import type { PopulationHost } from './PopulationHost';
import type { StoragePlaces } from './StoragePlaces';
import type { TileCoord } from './TileCoord';
import { WoodcutterTrips } from './WoodcutterTrips';

export class WorkerTrips {
  private readonly woodcutters: WoodcutterTrips;

  /**
   * Trips in `world` to the storage places `stores`, delivering into `economy`; `jobs` is told when a worker
   * gives its job up. A carrier whose target storage place is removed re-targets on its next tick.
   */
  public constructor(
    private readonly world: PopulationHost,
    private readonly stores: StoragePlaces,
    private readonly economy: Economy,
    private readonly jobs: Jobs,
    private readonly walker: PeasantWalker,
  ) {
    this.woodcutters = new WoodcutterTrips(world, walker);
  }

  /** True when `p` works at a building that needs trees (a woodcutter's hut). */
  public isWoodcutter(p: Peasant): boolean {
    return this.woodcutters.isWoodcutter(p);
  }

  /** Gives the idle `p` the vacant job at `buildingId` and sends it there; with no path it gives the job up. */
  public startWork(p: Peasant, buildingId: number): void {
    this.jobs.take(buildingId, p);
    if (!this.planWorkWalk(p)) this.giveUpJob(p);
  }

  /**
   * Hands the working `p` its building's finished batch and sends it to the nearest storage place for it. Returns
   * the tree a chopping woodcutter has just felled (for the caller to remove), else null.
   */
  public carry(p: Peasant, load: Load): number | null {
    const felled = p.state === 'chopping' ? p.treeId : null;
    this.woodcutters.release(p);
    p.pickUp(load);
    this.planDelivery(p);
    return felled;
  }

  /** Makes `p` idle where it stands, dropping its load and freeing its job; fine when its workplace is already gone. */
  public stop(p: Peasant): void {
    this.woodcutters.release(p);
    this.jobs.release(p, false);
    p.goIdle();
  }

  /**
   * True when `p` carries a load, waits after a failed search and a storage place for its load stands: one exists,
   * but it cannot reach it.
   */
  public isStranded(p: Peasant): boolean {
    return p.state === 'toStore' && p.waitTicks > 0 && p.load !== null && this.stores.anyFor(p.load.resource);
  }

  /**
   * Advances the worker `p` by one tick of what its state has it do (idle peasants are `IdleStands`' business).
   * Call once per tick per peasant, in ascending id order.
   */
  public tick(p: Peasant): void {
    switch (p.state) {
      case 'idle': // see IdleStands
      case 'chopping': // production hands it the wood when the tree falls (see `carry`)
        break;
      case 'working': // stands at work (production hands it each batch), or a woodcutter waits for a free tree
        if (p.waitTicks > 0 && !this.woodcutters.tickWaiting(p)) this.giveUpJob(p);
        break;
      case 'toTree':
        if (!this.woodcutters.tickToTree(p)) this.giveUpJob(p);
        break;
      case 'toWork':
      case 'toWorkBack':
        this.tickToWork(p);
        break;
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
    if (!this.isAt(p, p.workplaceId)) {
      if (!this.planWorkWalk(p)) this.giveUpJob(p);
    } else if (!this.woodcutters.isWoodcutter(p)) {
      p.startWorking();
    } else if (!this.woodcutters.atHut(p)) {
      this.giveUpJob(p);
    }
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
    this.woodcutters.release(p);
    this.jobs.release(p, true);
    p.goIdle();
  }

  /** True when `p`'s walk is no good any more: its delivery target is gone, or the next tile was built over. */
  private needsNewPath(p: Peasant): boolean {
    return (p.state === 'toStore' && !this.stores.has(p.targetId)) || this.walker.isNextStepBlocked(p);
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
      p.waitToRetry();
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
