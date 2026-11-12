// Production buildings: per-building cycle progress, whether each can work, and adding their yield every tick.
import type { Economy } from './Economy';
import type { GameMap } from './GameMap';
import type { MapObject } from './MapObject';
import { OBJECT_KINDS, ObjectKind, type ProductionInfo } from './ObjectKind';

/** Why a production building is or is not advancing. */
export type ProductionStatus = 'working' | 'noTrees' | 'storageFull';

/** What a production building is doing: its status and how many of `cycleTicks` it has done in this cycle. */
export interface ProductionState {
  readonly status: ProductionStatus;
  readonly progress: number;
  readonly cycleTicks: number;
}

/** One producing building and its mutable progress. */
interface Producer {
  readonly object: MapObject;
  readonly info: ProductionInfo;
  readonly width: number;
  readonly height: number;
  progress: number;
  /** Cached tree check for buildings that need trees; null when it must be recomputed. */
  treesNearby: boolean | null;
}

export class Production {
  /** Producers by object id; ids only increase, so insertion order is ascending id order. */
  private readonly producers = new Map<number, Producer>();

  /** Works on `economy`; `isTreeAt` says whether a tree stands on an in-bounds tile of `map`. */
  public constructor(
    private readonly map: GameMap,
    private readonly economy: Economy,
    private readonly isTreeAt: (tx: number, ty: number) => boolean,
  ) {}

  /** Call for every object added to the world: starts a producer at progress 0, or updates the tree checks. */
  public added(object: MapObject): void {
    if (object.kind === ObjectKind.Tree) {
      for (const p of this.producers.values()) {
        if (p.treesNearby === false && this.inTreeRange(p, object)) p.treesNearby = true;
      }
      return;
    }
    const { production, width, height } = OBJECT_KINDS[object.kind];
    if (!production) return;
    this.producers.set(object.id, { object, info: production, width, height, progress: 0, treesNearby: null });
  }

  /** Call for every object removed from the world: forgets a producer, or invalidates tree checks near a tree. */
  public removed(object: MapObject): void {
    if (object.kind !== ObjectKind.Tree) {
      this.producers.delete(object.id);
      return;
    }
    for (const p of this.producers.values()) {
      if (p.treesNearby === true && this.inTreeRange(p, object)) p.treesNearby = null;
    }
  }

  /** Advances every working producer by one tick in ascending id order, adding its yield when a cycle completes. */
  public tick(): void {
    for (const p of this.producers.values()) {
      if (this.status(p) !== 'working') continue;
      p.progress++;
      if (p.progress < p.info.cycleTicks) continue;
      this.economy.add(p.info.resource, p.info.yield);
      p.progress = 0;
    }
  }

  /** The state of the producer with `objectId`, or null when that object does not exist or does not produce. */
  public state(objectId: number): ProductionState | null {
    const p = this.producers.get(objectId);
    return p ? { status: this.status(p), progress: p.progress, cycleTicks: p.info.cycleTicks } : null;
  }

  private status(p: Producer): ProductionStatus {
    if (p.info.treeRadius !== null && !this.hasTreesNearby(p)) return 'noTrees';
    const { resource } = p.info;
    if (this.economy.amount(resource) >= this.economy.capacity(resource)) return 'storageFull';
    return 'working';
  }

  private hasTreesNearby(p: Producer): boolean {
    if (p.treesNearby === null) p.treesNearby = this.scanForTrees(p);
    return p.treesNearby;
  }

  /** Looks at every in-bounds tile within the producer's tree radius of its footprint. */
  private scanForTrees(p: Producer): boolean {
    const r = p.info.treeRadius ?? 0;
    const { tx, ty } = p.object;
    const x0 = Math.max(0, tx - r);
    const y0 = Math.max(0, ty - r);
    const x1 = Math.min(this.map.width - 1, tx + p.width - 1 + r);
    const y1 = Math.min(this.map.height - 1, ty + p.height - 1 + r);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) if (this.isTreeAt(x, y)) return true;
    }
    return false;
  }

  /** True when `tree` stands within the producer's tree radius (Chebyshev distance from the footprint). */
  private inTreeRange(p: Producer, tree: MapObject): boolean {
    if (p.info.treeRadius === null) return false;
    const { tx, ty } = p.object;
    const dx = Math.max(tx - tree.tx, 0, tree.tx - (tx + p.width - 1));
    const dy = Math.max(ty - tree.ty, 0, tree.ty - (ty + p.height - 1));
    return Math.max(dx, dy) <= p.info.treeRadius;
  }
}
