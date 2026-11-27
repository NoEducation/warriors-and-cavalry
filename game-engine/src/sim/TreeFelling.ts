// Chopped and felled trees and their stumps: a tree gives `treeChops` rounds of wood, then becomes a stump on the same
// tile, and stumps are cleared in time.
import type { Listeners } from './Listeners';
import type { ObjectIndex } from './ObjectIndex';
import { ObjectKind } from './ObjectKind';
import type { ObjectLifecycle } from './ObjectLifecycle';
import { POPULATION_CONFIG } from './populationConfig';
import type { Stumps } from './Stumps';
import type { WorldChange } from './WorldCommand';

export class TreeFelling {
  /** Rounds already taken per standing tree id; trees never chopped are absent. */
  private readonly taken = new Map<number, number>();

  /**
   * Changes the objects of `index` through `lifecycle`; `stumps` counts the stumps down; `listeners` hear of each
   * round taken from a tree that still stands.
   */
  public constructor(
    private readonly index: ObjectIndex,
    private readonly lifecycle: ObjectLifecycle,
    private readonly stumps: Stumps,
    private readonly listeners: Listeners<WorldChange>,
  ) {}

  /**
   * Takes one round from each tree of `treeIds`, in that order: a tree that has given `treeChops` rounds is replaced
   * by a stump on its tile, any other is announced as `chopped`. Ids that are not trees are skipped. Call with the
   * trees whose chopping batch finished this tick.
   */
  public chop(treeIds: readonly number[]): void {
    for (const id of treeIds) {
      const tree = this.index.objectById(id);
      if (tree?.kind !== ObjectKind.Tree) continue;
      const taken = this.chopsTaken(id) + 1;
      if (taken < POPULATION_CONFIG.treeChops) {
        this.taken.set(id, taken);
        this.listeners.notify({ type: 'chopped', object: tree });
        continue;
      }
      this.taken.delete(id);
      this.lifecycle.remove(tree);
      this.lifecycle.add(ObjectKind.Stump, tree.tx, tree.ty);
    }
  }

  /** Rounds already taken from the standing tree `id`; 0 for an untouched tree or any other id. */
  public chopsTaken(id: number): number {
    return this.taken.get(id) ?? 0;
  }

  /** Counts every stump down one tick and removes those whose time is up, in ascending id order. Call once per tick. */
  public tick(): void {
    for (const id of this.stumps.tick()) {
      const stump = this.index.objectById(id);
      if (stump) this.lifecycle.remove(stump);
    }
  }
}
