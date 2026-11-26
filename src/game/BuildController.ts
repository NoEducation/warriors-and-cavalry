// Turns the selected build tool and clicked tile into World commands. No DOM, no three.js.
import { OBJECT_KINDS, ObjectKind } from '../sim/ObjectKind';
import type { PlacementPreview } from '../sim/PlacementPreview';
import { RESOURCE_NAMES } from '../sim/ResourceKind';
import type { TileCoord } from '../sim/TileCoord';
import type { WallLinePreview } from '../sim/WallBuilder';
import type { World } from '../sim/World';
import type { CommandResult } from '../sim/WorldCommand';
import type { BuildTool } from '../ui/BuildTool';

type FailureReason = Extract<CommandResult, { ok: false }>['reason'];

const REASON_TEXT: Record<FailureReason, string> = {
  NotBuildable: 'not buildable',
  OutOfBounds: 'out of bounds',
  BadTerrain: 'bad terrain',
  Occupied: 'occupied',
  TooSteep: 'too steep',
  NeedsRock: 'needs rock nearby',
  // Used only if the economy cannot name the missing resource; `click` normally says `not enough wood` etc.
  NotEnoughResources: 'not enough resources',
  UnknownObject: 'nothing here',
  NotDemolishable: 'trees cannot be removed',
  UnknownCommand: 'unknown command',
};

export class BuildController {
  private currentTool: BuildTool = null;
  /** Where the wall drag in progress started, or null when none is. */
  private wallStart: TileCoord | null = null;

  /**
   * Holds no world: `preview` and `click` get the world to act on with every call.
   * `onMessage` receives a player-facing text for every rejected click.
   */
  public constructor(private readonly onMessage: (text: string) => void) {}

  /** The selected tool, or null when none is selected. */
  public get tool(): BuildTool {
    return this.currentTool;
  }

  /** True while a wall drag is in progress. */
  public get isWallDragging(): boolean {
    return this.wallStart !== null;
  }

  /** Selects `tool`; null deselects. Cancels a wall drag. Call from the build bar, tool keys, Escape or right-click. */
  public selectTool(tool: BuildTool): void {
    this.currentTool = tool;
    this.wallStart = null;
  }

  /**
   * Starts a wall drag at `tile` when the Wall tool is selected and `tile` is not null. Call on a left press; `world`
   * is taken like in the other drag calls, though starting reads nothing from it yet.
   */
  public startWallDrag(world: World, tile: TileCoord | null): void {
    if (tile && this.isWallTool()) this.wallStart = { tx: tile.tx, ty: tile.ty };
  }

  /** What the wall drag would build if released over `tile`; null without a drag or tile. Call per frame. */
  public wallDragPreview(world: World, tile: TileCoord | null): WallLinePreview | null {
    if (!this.wallStart || !tile) return null;
    return world.previewWallLine(this.wallStart, tile);
  }

  /**
   * Ends the wall drag by building the line from its start to `tile` (just the start piece when `tile` is null);
   * null when no drag was in progress. Reports failures through `onMessage`. Call on a left release.
   */
  public finishWallDrag(world: World, tile: TileCoord | null): CommandResult | null {
    const start = this.wallStart;
    if (!start) return null;
    this.wallStart = null;
    const end = tile ?? start;
    const result = world.apply({ type: 'placeWallLine', fromTx: start.tx, fromTy: start.ty, toTx: end.tx, toTy: end.ty });
    if (!result.ok) this.onMessage(`Cannot build: ${this.buildFailureText(world, ObjectKind.Wall, result.reason)}`);
    return result;
  }

  /** Drops the wall drag in progress without building. Call on Escape or a right click during a drag. */
  public cancelWallDrag(): void {
    this.wallStart = null;
  }

  /**
   * Where the selected building would go on `tile` of `world`; `ok` only when it fits there and its cost can be paid.
   * Null without a build tool or tile. Call per frame.
   */
  public preview(world: World, tile: TileCoord | null): PlacementPreview | null {
    const tool = this.currentTool;
    if (!tile || tool?.type !== 'build') return null;
    const ok = world.canPlace(tool.kind, tile.tx, tile.ty).ok && world.economy.canAfford(OBJECT_KINDS[tool.kind].cost);
    return { kind: tool.kind, tx: tile.tx, ty: tile.ty, ok };
  }

  /**
   * Applies the selected tool to `tile` of `world`; null when there is no tool or tile, and with the Wall tool (its
   * release builds instead). Reports failures through `onMessage`. Call on a left click on the map.
   */
  public click(world: World, tile: TileCoord | null): CommandResult | null {
    const tool = this.currentTool;
    if (!tile || !tool || this.isWallTool()) return null;
    if (tool.type === 'build') {
      const result = world.apply({ type: 'placeBuilding', kind: tool.kind, tx: tile.tx, ty: tile.ty });
      if (!result.ok) this.onMessage(`Cannot build: ${this.buildFailureText(world, tool.kind, result.reason)}`);
      return result;
    }
    const target = world.objectAt(tile.tx, tile.ty);
    const result: CommandResult = target
      ? world.apply({ type: 'demolish', objectId: target.id })
      : { ok: false, reason: 'UnknownObject' };
    if (!result.ok) this.onMessage(`Cannot demolish: ${REASON_TEXT[result.reason]}`);
    return result;
  }

  private isWallTool(): boolean {
    return this.currentTool?.type === 'build' && this.currentTool.kind === ObjectKind.Wall;
  }

  /** The reason text for a rejected placement; a cost that cannot be paid names the first resource that falls short. */
  private buildFailureText(world: World, kind: ObjectKind, reason: FailureReason): string {
    if (reason !== 'NotEnoughResources') return REASON_TEXT[reason];
    const missing = world.economy.missing(OBJECT_KINDS[kind].cost);
    return missing === null ? REASON_TEXT[reason] : `not enough ${RESOURCE_NAMES[missing]}`;
  }
}
