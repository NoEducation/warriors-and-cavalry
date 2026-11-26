// Felled trees and their stumps: a felled tree becomes a stump on the same tile, and stumps are cleared in time.
import type { ObjectIndex } from './ObjectIndex';
import { ObjectKind } from './ObjectKind';
import type { ObjectLifecycle } from './ObjectLifecycle';
import type { Stumps } from './Stumps';

export class TreeFelling {
  /** Changes the objects of `index` through `lifecycle`; `stumps` counts the stumps down. */
  public constructor(
    private readonly index: ObjectIndex,
    private readonly lifecycle: ObjectLifecycle,
    private readonly stumps: Stumps,
  ) {}

  /** Replaces each tree of `treeIds` (in that order) by a stump on its tile. Ids that are not trees are skipped. */
  public fell(treeIds: readonly number[]): void {
    for (const id of treeIds) {
      const tree = this.index.objectById(id);
      if (tree?.kind !== ObjectKind.Tree) continue;
      this.lifecycle.remove(tree);
      this.lifecycle.add(ObjectKind.Stump, tree.tx, tree.ty);
    }
  }

  /** Counts every stump down one tick and removes those whose time is up, in ascending id order. Call once per tick. */
  public tick(): void {
    for (const id of this.stumps.tick()) {
      const stump = this.index.objectById(id);
      if (stump) this.lifecycle.remove(stump);
    }
  }
}
