// The woodcutter's part of a trip: picking the nearest free tree in reach of its hut, walking there and chopping.
import type { MapObject } from './MapObject';
import { OBJECT_KINDS, ObjectKind } from './ObjectKind';
import { PATH_CONFIG } from './pathConfig';
import type { Peasant } from './Peasant';
import type { PeasantWalker } from './PeasantWalker';
import type { PopulationHost } from './PopulationHost';
import type { TileCoord } from './TileCoord';
import { TreeClaims } from './TreeClaims';

/** A tree a woodcutter may pick and the walkable tiles it can chop it from. */
interface Candidate {
  readonly id: number;
  readonly tiles: readonly TileCoord[];
}

/** What picking a tree came to: heading for one, none free in reach, or free ones none of which it can reach. */
type PickResult = 'heading' | 'none' | 'unreachable';

export class WoodcutterTrips {
  private readonly claims = new TreeClaims();

  /** Woodcutters of `world`, walked by `walker`. */
  public constructor(
    private readonly world: PopulationHost,
    private readonly walker: PeasantWalker,
  ) {}

  /** True when `p` works at a building that needs trees (a woodcutter's hut). */
  public isWoodcutter(p: Peasant): boolean {
    const workplace = p.workplaceId === null ? undefined : this.world.objectById(p.workplaceId);
    return workplace !== undefined && OBJECT_KINDS[workplace.kind].production?.treeRadius != null;
  }

  /**
   * `p` stands at its hut: heads for the nearest free tree in reach, or waits there when there is none. False when
   * free trees exist but none can be reached (the caller gives the job up).
   */
  public atHut(p: Peasant): boolean {
    const result = this.pickTree(p);
    if (result === 'none') p.waitAtWork();
    return result !== 'unreachable';
  }

  /** One tick of a wait at the hut; when it ends, looks for a tree again. False as for `atHut`. */
  public tickWaiting(p: Peasant): boolean {
    return !p.countDownWait() || this.atHut(p);
  }

  /**
   * One tick of walking to its tree: picks again when the tree is gone or the way is blocked, starts chopping on
   * arrival. False when no tree can be picked any more (the caller gives the job up).
   */
  public tickToTree(p: Peasant): boolean {
    const tree = p.treeId === null ? undefined : this.world.objectById(p.treeId);
    if ((tree?.kind !== ObjectKind.Tree || this.walker.isNextStepBlocked(p)) && this.pickTree(p) !== 'heading') {
      return false;
    }
    this.walker.tick(p);
    if (p.stepTicks > 0 || p.pathIndex < p.path.length) return true;
    if (this.isNextTo(p, p.treeId)) {
      p.startChopping();
      return true;
    }
    return this.pickTree(p) === 'heading';
  }

  /** Frees the tree `p` has claimed, if any. Call before it goes idle or picks up its wood. */
  public release(p: Peasant): void {
    if (p.treeId === null) return;
    this.claims.release(p.treeId);
    p.dropTree();
  }

  /**
   * Releases `p`'s tree, then one search toward every free tree in reach, bounded by `treeSearchMaxExpanded`;
   * claims the one the path ends next to.
   */
  private pickTree(p: Peasant): PickResult {
    this.release(p);
    const candidates = this.candidates(p.workplaceId);
    if (candidates.length === 0) return 'none';
    const goals: TileCoord[] = [];
    for (const candidate of candidates) goals.push(...candidate.tiles);
    if (!this.walker.walkTo(p, goals, PATH_CONFIG.treeSearchMaxExpanded)) return 'unreachable';
    const end = p.path.length > 0 ? p.path[p.path.length - 1] : { tx: p.nextTx, ty: p.nextTy };
    const tree = candidates.find(({ tiles }) => tiles.some((t) => t.tx === end.tx && t.ty === end.ty));
    if (!tree) return 'unreachable';
    this.claims.claim(tree.id, p.id);
    p.headToTree(tree.id);
    return 'heading';
  }

  /** The unclaimed trees within the tree radius of hut `hutId` (Chebyshev from its footprint), row by row. */
  private candidates(hutId: number | null): Candidate[] {
    const hut = hutId === null ? undefined : this.world.objectById(hutId);
    const info = hut ? OBJECT_KINDS[hut.kind] : undefined;
    const r = info?.production?.treeRadius;
    if (!hut || !info || r == null) return [];
    const { map } = this.world;
    const found: Candidate[] = [];
    for (let ty = Math.max(0, hut.ty - r); ty <= Math.min(map.height - 1, hut.ty + info.height - 1 + r); ty++) {
      for (let tx = Math.max(0, hut.tx - r); tx <= Math.min(map.width - 1, hut.tx + info.width - 1 + r); tx++) {
        const object = this.world.objectAt(tx, ty);
        if (object && this.isFreeTree(object)) found.push({ id: object.id, tiles: this.world.accessTiles(object.id) });
      }
    }
    return found;
  }

  private isFreeTree(object: MapObject): boolean {
    return object.kind === ObjectKind.Tree && !this.claims.isClaimed(object.id);
  }

  /** True when `p` stands on a tile sharing an edge with the tree `treeId`. */
  private isNextTo(p: Peasant, treeId: number | null): boolean {
    const tree = treeId === null ? undefined : this.world.objectById(treeId);
    return tree !== undefined && Math.abs(p.tx - tree.tx) + Math.abs(p.ty - tree.ty) === 1;
  }
}
