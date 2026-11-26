// The wall line command: which tiles of a dragged line get a wall piece, what they cost, and building them.
import type { Economy } from './Economy';
import type { MapObject } from './MapObject';
import { OBJECT_KINDS, ObjectKind } from './ObjectKind';
import { RESOURCE_KINDS, type ResourceAmounts, ResourceKind, resources } from './ResourceKind';
import type { TileCoord } from './TileCoord';
import { wallLineTiles } from './wallLine';
import {
  type CommandFailure,
  hasWholeTileCoordinates,
  type PlaceWallLineCommand,
  type PlacementCheck,
  type PlacementFailure,
  type WallLineSuccess,
} from './WorldCommand';

/** What a wall line from one tile to another would build right now, without building it. */
export interface WallLinePreview {
  /** The line's tiles in order from its start, cut to `WALL_LINE_MAX_TILES`. */
  readonly tiles: readonly TileCoord[];
  /** Per tile of `tiles`: true only when the command would place a piece there now. */
  readonly placeable: readonly boolean[];
  /** How many pieces the command would place. */
  readonly placedCount: number;
  /** What those pieces cost together. */
  readonly cost: ResourceAmounts;
}

/** The walk over a line's tiles that both the preview and the command use. */
interface WallLinePlan extends WallLinePreview {
  readonly skipped: number;
  readonly unpaid: number;
  /** The first tile's rule failure, or null when the first tile is valid. */
  readonly firstFailure: PlacementFailure | null;
}

/** The world the builder works on; `ObjectLifecycle` is one. */
export interface WallSite {
  /** Whether a building of `kind` may stand at (tx, ty), as `World.canPlace`. */
  canPlace(kind: ObjectKind, tx: number, ty: number): PlacementCheck;
  /**
   * Adds an object and tells the listeners. Skips the building rules and the cost on purpose: `plan()` already
   * checked every piece with `canPlace`, and `build` pays for each piece itself.
   */
  add(kind: ObjectKind, tx: number, ty: number): MapObject;
}

const WALL_COST = OBJECT_KINDS[ObjectKind.Wall].cost;

export class WallBuilder {
  /** Builds wall lines on `site`, paying from `economy`. */
  public constructor(private readonly site: WallSite, private readonly economy: Economy) {}

  /** What a wall line from `from` to `to` would build now; changes nothing. Call per frame for the drag ghost. */
  public preview(from: TileCoord, to: TileCoord): WallLinePreview {
    const { tiles, placeable, placedCount, cost } = this.plan(from, to);
    return { tiles, placeable, placedCount, cost };
  }

  /**
   * Builds and pays for the pieces `preview` marks placeable, one `added` change each in tile order. When none is
   * placeable, fails with `NotEnoughResources` if a tile was valid, else with the first tile's rule failure; a command
   * whose coordinates are not safe integers fails with `UnknownCommand`. A failure changes nothing. Call from
   * `World.apply` for a `placeWallLine` command.
   */
  public build(command: PlaceWallLineCommand): WallLineSuccess | CommandFailure {
    if (!hasWholeTileCoordinates(command)) return { ok: false, reason: 'UnknownCommand' };
    const plan = this.plan({ tx: command.fromTx, ty: command.fromTy }, { tx: command.toTx, ty: command.toTy });
    if (plan.placedCount === 0) {
      return { ok: false, reason: plan.unpaid > 0 ? 'NotEnoughResources' : (plan.firstFailure ?? 'NotBuildable') };
    }
    plan.tiles.forEach((tile, i) => {
      if (!plan.placeable[i]) return;
      this.economy.spend(WALL_COST); // always succeeds: the plan counted only affordable pieces
      this.site.add(ObjectKind.Wall, tile.tx, tile.ty);
    });
    return { ok: true, placed: plan.placedCount, skipped: plan.skipped, unpaid: plan.unpaid };
  }

  /**
   * Walks the tiles from `from`: a tile failing a Wall placement rule is skipped; a valid one is placeable while the
   * stone lasts; from the first valid tile it does not cover on, valid tiles are unpaid. Pieces are one tile each,
   * so placing one never changes whether another tile of the line is valid.
   */
  private plan(from: TileCoord, to: TileCoord): WallLinePlan {
    const tiles = wallLineTiles(from, to);
    const affordable = this.affordablePieces();
    const placeable: boolean[] = [];
    let placedCount = 0;
    let skipped = 0;
    let unpaid = 0;
    // True from the first valid tile the stone does not cover: no piece is placed after it.
    let stopped = false;
    let firstFailure: PlacementFailure | null = null;
    for (const tile of tiles) {
      const check = this.site.canPlace(ObjectKind.Wall, tile.tx, tile.ty);
      if (!check.ok) {
        // Skip: the tile fails a rule. Skipped tiles are counted only up to where placing stopped.
        if (placeable.length === 0) firstFailure = check.reason;
        if (!stopped) skipped++;
        placeable.push(false);
      } else if (!stopped && placedCount < affordable) {
        // Place: valid and paid for.
        placedCount++;
        placeable.push(true);
      } else {
        // Stop: valid but the stone has run out; this and every later valid tile is unpaid.
        stopped = true;
        unpaid++;
        placeable.push(false);
      }
    }
    return { tiles, placeable, placedCount, cost: times(WALL_COST, placedCount), skipped, unpaid, firstFailure };
  }

  /** How many wall pieces the economy can pay for now. */
  private affordablePieces(): number {
    let pieces = Number.MAX_SAFE_INTEGER;
    for (const kind of RESOURCE_KINDS) {
      if (WALL_COST[kind] > 0) pieces = Math.min(pieces, Math.floor(this.economy.amount(kind) / WALL_COST[kind]));
    }
    return pieces;
  }
}

/** `cost` taken `count` times. */
function times(cost: ResourceAmounts, count: number): ResourceAmounts {
  return resources(cost[ResourceKind.Wood] * count, cost[ResourceKind.Stone] * count, cost[ResourceKind.Food] * count);
}
