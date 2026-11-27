// The woodcutter's part of a trip: picking the nearest free tree in reach of its hut (started trees first), walking
// there and chopping.
import type { MapObject } from './MapObject';
import { OBJECT_KINDS, ObjectKind } from './ObjectKind';
import { PATH_CONFIG } from './pathConfig';
import type { Peasant } from './Peasant';
import type { PeasantWalker } from './PeasantWalker';
import { type PathTarget, targetAtWalkEnd, targetTiles } from './pathTargets';
import type { PopulationHost } from './PopulationHost';
import { TreeClaims } from './TreeClaims';

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
    const workplace = this.world.objectById(p.workplaceId);
    return workplace !== undefined && OBJECT_KINDS[workplace.kind].production?.treeRadius != null;
  }

  /** `p` has reached its workplace: starts working there, or (a woodcutter) heads for the nearest free tree in reach. */
  public arriveAtWork(p: Peasant): void {
    if (this.isWoodcutter(p)) this.lookForTree(p);
    else p.startWorking();
  }

  /**
   * One tick of a woodcutter's own part of its trip: walking to its tree, or waiting for a free or reachable one.
   * Other workers and states are left alone.
   */
  public tick(p: Peasant): void {
    if (p.waitTicks > 0 && (p.state === 'toTree' || p.state === 'working')) {
      if (p.countDownWait()) this.lookForTree(p);
    } else if (p.state === 'toTree') {
      this.tickToTree(p);
    }
  }

  /**
   * True when `p` is a woodcutter waiting for a way to the free trees in reach of its hut, all of which it cannot
   * reach now.
   */
  public isCutOff(p: Peasant): boolean {
    return p.state === 'toTree' && p.waitTicks > 0;
  }

  /**
   * Heads `p` for the nearest free tree in reach of its hut. With none free it waits where it is (`noTrees`); with
   * free ones it cannot reach it waits too (`isCutOff`); either way it looks again after the wait.
   */
  private lookForTree(p: Peasant): void {
    const result = this.pickTree(p);
    if (result === 'none') p.waitAtWork();
    else if (result === 'unreachable') p.waitForTree();
  }

  /**
   * One tick of walking to its tree: picks again when the tree is gone or the way is blocked, starts chopping on
   * arrival.
   */
  private tickToTree(p: Peasant): void {
    const tree = p.treeId === null ? undefined : this.world.objectById(p.treeId);
    if (tree?.kind !== ObjectKind.Tree || this.walker.isNextStepBlocked(p)) {
      this.lookForTree(p);
      if (p.state !== 'toTree' || p.waitTicks > 0) return;
    }
    this.walker.tick(p);
    if (p.stepTicks > 0 || p.pathIndex < p.path.length) return;
    if (this.isNextTo(p, p.treeId)) p.startChopping();
    else this.lookForTree(p);
  }

  /** Frees the tree `p` has claimed, if any. Call before it is removed or picks up its wood. */
  public release(p: Peasant): void {
    if (p.treeId === null) return;
    this.claims.release(p.treeId);
    p.dropTree();
  }

  /**
   * Releases `p`'s tree, then searches toward the free started trees in reach (so trees get finished), and when none
   * can be reached toward every free tree in reach; each search bounded by `treeSearchMaxExpanded`. Claims the tree
   * the path ends next to.
   */
  private pickTree(p: Peasant): PickResult {
    this.release(p);
    const candidates = this.candidates(p.workplaceId);
    if (candidates.length === 0) return 'none';
    const started = candidates.filter((c) => this.world.treeChopsTaken(c.id) > 0);
    const tree = (started.length > 0 ? this.headFor(p, started) : null) ?? this.headFor(p, candidates);
    if (!tree) return 'unreachable';
    this.claims.claim(tree.id, p.id);
    p.headToTree(tree.id);
    return 'heading';
  }

  /** Sets `p` walking to the nearest reachable tree of `trees` and returns it; null when none can be reached. */
  private headFor(p: Peasant, trees: readonly PathTarget[]): PathTarget | null {
    if (!this.walker.walkTo(p, targetTiles(trees), PATH_CONFIG.treeSearchMaxExpanded)) return null;
    return targetAtWalkEnd(p, trees) ?? null;
  }

  /** The unclaimed trees within the tree radius of hut `hutId` (Chebyshev from its footprint), row by row. */
  private candidates(hutId: number): PathTarget[] {
    const hut = this.world.objectById(hutId);
    const info = hut ? OBJECT_KINDS[hut.kind] : undefined;
    const r = info?.production?.treeRadius;
    if (!hut || !info || r == null) return [];
    const { map } = this.world;
    const found: PathTarget[] = [];
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
