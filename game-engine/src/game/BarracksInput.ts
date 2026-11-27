// The Barracks panel's wiring: opening it for a clicked Barracks, training from its buttons, closing it when the
// Barracks is gone.
import { ObjectKind } from '../sim/ObjectKind';
import type { TileCoord } from '../sim/TileCoord';
import type { UnitKind } from '../sim/UnitKind';
import type { World } from '../sim/World';
import { BarracksPanel } from '../ui/BarracksPanel';

/** Why `trainUnit` failed, as the player reads it. */
const TRAIN_FAILURE_TEXT: Record<string, string> = {
  NotEnoughResources: 'not enough food or wood',
  NoSoldierRoom: 'no room for more soldiers: build another barracks',
  QueueFull: 'the queue is full',
};

export class BarracksInput {
  private readonly panel: BarracksPanel;
  /** The Barracks the panel shows; null while closed. */
  private barracksId: number | null = null;

  /** Builds the panel in `parent`; `currentWorld` gives the world shown, `onMessage` tells the player of failures. */
  public constructor(
    parent: HTMLElement,
    private readonly currentWorld: () => World,
    private readonly onMessage: (text: string) => void,
  ) {
    this.panel = new BarracksPanel(parent, (kind) => this.train(kind), () => this.close());
  }

  /** True while the panel is open. */
  public get isOpen(): boolean {
    return this.barracksId !== null;
  }

  /** Opens the panel for the Barracks on `tile` of `world`; false (nothing opened) when there is none. */
  public openAt(world: World, tile: TileCoord): boolean {
    const object = world.objectAt(tile.tx, tile.ty);
    if (object?.kind !== ObjectKind.Barracks) return false;
    this.barracksId = object.id;
    this.panel.show();
    this.update(world);
    return true;
  }

  /** Closes the panel. */
  public close(): void {
    this.barracksId = null;
    this.panel.hide();
  }

  /** Refreshes the open panel from `world`, closing it when its Barracks is gone. Call once per frame. */
  public update(world: World): void {
    if (this.barracksId === null) return;
    const queue = world.trainingQueue(this.barracksId);
    if (!queue) return this.close();
    this.panel.update({ queue, soldiers: world.soldiers, economy: world.economy });
  }

  private train(kind: UnitKind): void {
    if (this.barracksId === null) return;
    const result = this.currentWorld().apply({ type: 'trainUnit', barracksId: this.barracksId, unitKind: kind });
    if (!result.ok) this.onMessage(`Cannot train: ${TRAIN_FAILURE_TEXT[result.reason] ?? result.reason}`);
  }
}
