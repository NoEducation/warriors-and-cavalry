// The player's selected soldiers: picking them by click or box, and turning a right-click into an order command.
import type { TileCoord } from '../sim/TileCoord';
import { Side } from '../sim/UnitKind';
import type { World } from '../sim/World';
import type { CommandResult } from '../sim/WorldCommand';
import { nearestUnit } from './unitPick';

export class SelectionController {
  /** Selected unit ids; render and UI read them, only the player's clicks change them. */
  private readonly ids = new Set<number>();

  /** The selected unit ids in ascending order. */
  public get selected(): number[] {
    return [...this.ids].sort((a, b) => a - b);
  }

  /** True when no unit is selected. */
  public get isEmpty(): boolean {
    return this.ids.size === 0;
  }

  /**
   * A left click on `tile`: selects the player soldier on or next to it (with `additive`, toggles it into the
   * selection); clicking nothing clears the selection unless `additive`. True when it hit a soldier.
   */
  public clickAt(world: World, tile: TileCoord, additive: boolean): boolean {
    const unit = nearestUnit(world, tile, Side.Player);
    if (!unit) {
      if (!additive) this.ids.clear();
      return false;
    }
    if (!additive) this.ids.clear();
    if (additive && this.ids.has(unit.id)) this.ids.delete(unit.id);
    else this.ids.add(unit.id);
    return true;
  }

  /** Selects the living player units among `ids` (a box), replacing the selection unless `additive`. */
  public select(world: World, ids: readonly number[], additive: boolean): void {
    if (!additive) this.ids.clear();
    for (const id of ids) {
      const unit = world.unitById(id);
      if (unit && unit.side === Side.Player && unit.hitPoints > 0) this.ids.add(id);
    }
  }

  /**
   * A right click on `tile` with soldiers selected: an attack on the raider on or next to it, else a move there.
   * Null, sending nothing, with no selection.
   */
  public orderAt(world: World, tile: TileCoord): CommandResult | null {
    if (this.ids.size === 0) return null;
    const unitIds = this.selected;
    const raider = nearestUnit(world, tile, Side.Raider);
    if (raider) return world.apply({ type: 'orderAttack', unitIds, targetUnitId: raider.id });
    return world.apply({ type: 'orderMove', unitIds, tx: tile.tx, ty: tile.ty });
  }

  /** Forgets selected units that are dead or gone. Call once per frame. */
  public prune(world: World): void {
    for (const id of this.ids) {
      const unit = world.unitById(id);
      if (!unit || unit.hitPoints <= 0) this.ids.delete(id);
    }
  }

  /** Clears the selection (Escape, or a new map). */
  public clear(): void {
    this.ids.clear();
  }
}
