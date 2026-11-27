// A worker's trips: walking to work, carrying each batch to the nearest storage place, and walking back; a
// woodcutter's walks to its trees are `WoodcutterTrips`' part.
import type { Economy } from './Economy';
import type { Jobs } from './Jobs';
import type { Peasant } from './Peasant';
import type { PeasantWalker } from './PeasantWalker';
import type { Load } from './PeasantView';
import type { PopulationHost } from './PopulationHost';
import { targetAtWalkEnd, targetTiles } from './pathTargets';
import type { StoragePlaces } from './StoragePlaces';
import type { WoodcutterTrips } from './WoodcutterTrips';

export class WorkerTrips {
  /**
   * Trips in `world` to the storage places `stores`, delivering into `economy`; `jobs` is told when a worker is
   * dismissed, and `woodcutters` takes the woodcutters' walks to their trees. A carrier whose target storage place
   * is removed re-targets on its next tick.
   */
  public constructor(
    private readonly world: PopulationHost,
    private readonly stores: StoragePlaces,
    private readonly economy: Economy,
    private readonly jobs: Jobs,
    private readonly walker: PeasantWalker,
    private readonly woodcutters: WoodcutterTrips,
  ) {}

  /** Sends the new worker `p` from where it stands to its workplace; false when there is no way there. */
  public startWork(p: Peasant): boolean {
    return this.planWorkWalk(p);
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

  /**
   * Frees the tree `p` has claimed and its job, for the caller to remove it (its load is lost). Fine when its
   * workplace is already gone.
   */
  public dismiss(p: Peasant): void {
    this.woodcutters.release(p);
    this.jobs.release(p);
  }

  /**
   * True when `p` waits after a failed search for a way that exists but is blocked: to its workplace, to a storage
   * place for its load (one stands), or (a woodcutter) to the free trees in reach of its hut.
   */
  public isStranded(p: Peasant): boolean {
    if (p.waitTicks === 0) return false;
    if (p.state === 'toWork' || p.state === 'toWorkBack') return true;
    if (p.state === 'toStore') return p.load !== null && this.stores.anyFor(p.load.resource);
    return this.woodcutters.isCutOff(p);
  }

  /**
   * Advances the worker `p` by one tick of what its state has it do. Call once per tick per peasant, in ascending id
   * order.
   */
  public tick(p: Peasant): void {
    switch (p.state) {
      case 'chopping': // production hands it the wood when the tree falls (see `carry`)
        break;
      case 'working': // stands at work (production hands it each batch), or a woodcutter waits for a free tree
      case 'toTree':
        this.woodcutters.tick(p);
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

  /**
   * Walking to work (first or after a delivery): re-routes when blocked, starts working on arrival. With no way
   * there it waits where it stands and searches again, keeping its job.
   */
  private tickToWork(p: Peasant): void {
    if (p.waitTicks > 0) {
      if (!p.countDownWait()) return;
      if (!this.planWorkWalk(p)) return p.waitToRetry();
    } else if (this.needsNewPath(p) && !this.planWorkWalk(p)) {
      return p.waitToRetry();
    }
    this.walker.tick(p);
    if (!this.isWalkDone(p)) return;
    if (this.isAt(p, p.workplaceId)) this.woodcutters.arriveAtWork(p);
    else if (!this.planWorkWalk(p)) p.waitToRetry();
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

  /** Stores `p`'s load (what does not fit is lost) and sends it back to work, or has it wait when it cannot. */
  private deliverLoad(p: Peasant): void {
    const load = p.deliver();
    if (load) this.economy.add(load.resource, load.amount);
    if (!this.planWorkWalk(p)) p.waitToRetry();
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
    return this.walker.walkTo(p, this.world.accessTiles(p.workplaceId));
  }

  /**
   * One search toward every storage place for `p`'s load; the target is the one whose access tile the path ends on.
   * With none in reach, `p` waits where it is and searches again later.
   */
  private planDelivery(p: Peasant): void {
    const candidates = p.load ? this.stores.candidatesFor(p.load.resource) : [];
    p.setTarget(null);
    if (this.walker.walkTo(p, targetTiles(candidates))) p.setTarget(targetAtWalkEnd(p, candidates)?.id ?? null);
    else p.waitToRetry();
  }

  /** True when `p` stands on an access tile of the building `objectId`. */
  private isAt(p: Peasant, objectId: number | null): boolean {
    if (objectId === null) return false;
    return this.world.accessTiles(objectId).some((t) => t.tx === p.tx && t.ty === p.ty);
  }
}
