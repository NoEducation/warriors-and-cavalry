// Turns the selected build tool and clicked tile into World commands. No DOM, no three.js.
import { OBJECT_KINDS, ObjectKind } from '../sim/ObjectKind';
import type { PlacementPreview } from '../sim/PlacementPreview';
import { RESOURCE_NAMES } from '../sim/ResourceKind';
import type { TileCoord } from '../sim/TileCoord';
import type { WallLinePreview } from '../sim/WallBuilder';
import type { World } from '../sim/World';
import type { CommandResult } from '../sim/WorldCommand';
import type { BuildTool } from '../ui/BuildTool';
import { WallDrag } from './WallDrag';

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
  /** The wall drag in progress, or null when none is. */
  private wallDrag: WallDrag | null = null;

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
    return this.wallDrag !== null;
  }

  /** Selects `tool`; null deselects. Cancels a wall drag. Call from the build bar, tool keys, Escape or right-click. */
  public selectTool(tool: BuildTool): void {
    this.currentTool = tool;
    this.cancelWallDrag();
  }

  /** Starts a wall drag at `tile` when the Wall tool is selected and `tile` is not null. Call on a left press. */
  public startWallDrag(tile: TileCoord | null): void {
    if (tile && this.isWallTool()) this.wallDrag = new WallDrag({ tx: tile.tx, ty: tile.ty });
  }

  /**
   * What the wall drag would build if released over `tile`; with `tile` null (cursor off the map), the line to the
   * last tile seen, else just the start piece. Null without a drag. The same object as the previous call while the
   * end tile, the world's objects and its stone are unchanged. Call per frame.
   */
  public wallDragPreview(world: World, tile: TileCoord | null): WallLinePreview | null {
    return this.wallDrag?.previewTo(world, tile) ?? null;
  }

  /**
   * Ends the wall drag by building the line from its start to `tile`; with `tile` null, to the last tile
   * `wallDragPreview` saw, else just the start piece. Null when no drag was in progress. Reports failures and a line
   * the stone did not cover through `onMessage`. Call on a left release.
   */
  public finishWallDrag(world: World, tile: TileCoord | null): CommandResult | null {
    const drag = this.wallDrag;
    if (!drag) return null;
    const { start } = drag;
    const end = tile ?? drag.end;
    this.cancelWallDrag();
    const result = world.apply({ type: 'placeWallLine', fromTx: start.tx, fromTy: start.ty, toTx: end.tx, toTy: end.ty });
    this.reportWallLine(world, result);
    return result;
  }

  /** Drops the wall drag in progress without building. Call on Escape or a right click during a drag. */
  public cancelWallDrag(): void {
    this.wallDrag = null;
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

  /** Tells the player why a wall line failed, or how much of it the stone covered when it was not all built. */
  private reportWallLine(world: World, result: CommandResult): void {
    if (!result.ok) {
      this.onMessage(`Cannot build: ${this.buildFailureText(world, ObjectKind.Wall, result.reason)}`);
    } else if ('unpaid' in result && result.unpaid > 0) {
      const shortfall = this.buildFailureText(world, ObjectKind.Wall, 'NotEnoughResources');
      this.onMessage(`Wall: ${result.placed} of ${result.placed + result.unpaid} built, ${shortfall}`);
    }
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
