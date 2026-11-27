// The player's orders to soldiers: checking an order command, and where a group sent to one tile spreads out to.
import type { ArmyHost } from './ArmyHost';
import type { TileCoord } from './TileCoord';
import type { Unit } from './Unit';
import { Side } from './UnitKind';
import { WalkClass } from './walkRules';
import type { CommandFailure, OrderCommand, OrderSuccess } from './WorldCommand';

/** Rings searched round a move target for tiles to spread a group over. */
const SPREAD_RINGS = 8;

export class ArmyOrders {
  /** Orders for the units `units` of `world`. Create once per world. */
  public constructor(
    private readonly world: ArmyHost,
    private readonly units: ReadonlyMap<number, Unit>,
  ) {}

  /**
   * Gives the listed living player units a `move` or `attack` order. Fails, changing nothing, when the command is
   * malformed (`UnknownCommand`), the move tile is off the map (`OutOfBounds`), the attack target is not a living
   * raider (`UnknownUnit`), or no listed id is a living player unit (`NoUnits`). Repeated ids count once.
   */
  public apply(command: OrderCommand): OrderSuccess | CommandFailure {
    const { unitIds } = command;
    if (!Array.isArray(unitIds) || !unitIds.every((id) => Number.isSafeInteger(id))) return { ok: false, reason: 'UnknownCommand' };
    if (command.type === 'orderMove') {
      const { tx, ty } = command;
      if (!Number.isSafeInteger(tx) || !Number.isSafeInteger(ty)) return { ok: false, reason: 'UnknownCommand' };
      if (!this.world.map.inBounds(tx, ty)) return { ok: false, reason: 'OutOfBounds' };
    } else {
      const target = this.units.get(command.targetUnitId);
      if (!target || !target.alive || target.side !== Side.Raider) return { ok: false, reason: 'UnknownUnit' };
    }
    const soldiers = this.soldiers(unitIds);
    if (soldiers.length === 0) return { ok: false, reason: 'NoUnits' };
    if (command.type === 'orderAttack') {
      for (const unit of soldiers) unit.setOrder('attack', { type: 'unit', id: command.targetUnitId });
    } else {
      const tiles = this.spreadTiles(command.tx, command.ty, soldiers.length);
      soldiers.forEach((unit, i) => unit.setOrder('move', null, tiles[i].tx, tiles[i].ty));
    }
    return { ok: true, ordered: soldiers.length };
  }

  /** The living player units among `ids`, each once, in ascending id order. */
  private soldiers(ids: readonly number[]): Unit[] {
    const found: Unit[] = [];
    for (const id of new Set(ids)) {
      const unit = this.units.get(id);
      if (unit && unit.alive && unit.side === Side.Player) found.push(unit);
    }
    return found.sort((a, b) => a.id - b.id);
  }

  /**
   * `n` tiles a soldier may stand on round (tx, ty): the tile itself, then ring after ring outward (each row by row);
   * when there are fewer than `n` within the rings, they are handed out again from the first.
   */
  private spreadTiles(tx: number, ty: number, n: number): TileCoord[] {
    const tiles: TileCoord[] = [];
    for (let r = 0; r <= SPREAD_RINGS && tiles.length < n; r++) {
      for (let y = ty - r; y <= ty + r && tiles.length < n; y++) {
        for (let x = tx - r; x <= tx + r && tiles.length < n; x++) {
          const onRing = Math.max(Math.abs(x - tx), Math.abs(y - ty)) === r;
          if (onRing && this.world.map.inBounds(x, y) && this.world.walkClass(x, y) !== WalkClass.Blocked) tiles.push({ tx: x, ty: y });
        }
      }
    }
    if (tiles.length === 0) tiles.push({ tx, ty });
    for (let i = 0; tiles.length < n; i++) tiles.push(tiles[i]);
    return tiles;
  }
}
