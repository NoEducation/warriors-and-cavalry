// The world changes a layer has heard of but not drawn yet, kept until the layer's next update.
import type { World } from '../sim/World';
import type { WorldChange } from '../sim/WorldCommand';

export class WorldChangeQueue {
  private readonly pending: WorldChange[] = [];
  private readonly unsubscribe: () => void;

  /** Starts collecting the objects added to and removed from `world`. Create in a layer's constructor. */
  public constructor(world: World) {
    this.unsubscribe = world.onChange(this.onChange);
  }

  /** Hands every change since the last drain to `handle`, oldest first, then forgets them. Call from `update`. */
  public drain(handle: (change: WorldChange) => void): void {
    for (const change of this.pending) handle(change);
    this.pending.length = 0;
  }

  /** Stops collecting and drops the changes not drained yet. Call from the layer's `dispose`. */
  public dispose(): void {
    this.unsubscribe();
    this.pending.length = 0;
  }

  private readonly onChange = (change: WorldChange): void => {
    this.pending.push(change);
  };
}
