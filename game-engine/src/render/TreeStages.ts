// The stage each chopped tree is drawn at, so a layer shrinks a tree (or its shadow) once per round taken.
import type { World } from '../sim/World';
import type { TreeSlot } from './TreeShadowLayer';
import { shrinkToStage } from './treeStage';

export class TreeStages {
  /** Rounds taken as drawn, by id of a chopped, standing tree; untouched trees are absent. */
  private readonly shown = new Map<number, number>();

  /** Draws `slot` for a flat shadow disc (`flat`) or a whole tree. */
  public constructor(private readonly flat: boolean) {}

  /**
   * Shrinks `slot`, the instance of tree `treeId`, to the stage of the rounds taken from it in `world` now. Several
   * rounds may land between two frames, so it scales from the stage drawn so far. Call for each `chopped` change.
   */
  public chopped(world: World, treeId: number, slot: TreeSlot): void {
    const from = this.shown.get(treeId) ?? 0;
    const to = world.treeChopsTaken(treeId);
    if (to <= from) return;
    shrinkToStage(slot, from, to, this.flat);
    this.shown.set(treeId, to);
  }

  /** Forgets tree `treeId`. Call when it is removed. */
  public forget(treeId: number): void {
    this.shown.delete(treeId);
  }

  /** Forgets every tree. Call from the layer's `dispose`. */
  public clear(): void {
    this.shown.clear();
  }
}
