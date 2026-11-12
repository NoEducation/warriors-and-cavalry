// Turns the selected build tool and clicked tile into World commands. No DOM, no three.js.
import type { TileCoord } from '../sim/TileCoord';
import type { World } from '../sim/World';
import type { CommandResult } from '../sim/WorldCommand';
import type { BuildTool, PlacementPreview } from './BuildTool';

type FailureReason = Extract<CommandResult, { ok: false }>['reason'];

const REASON_TEXT: Record<FailureReason, string> = {
  NotBuildable: 'not buildable',
  OutOfBounds: 'out of bounds',
  BadTerrain: 'bad terrain',
  Occupied: 'occupied',
  TooSteep: 'too steep',
  UnknownObject: 'nothing here',
  NotDemolishable: 'trees cannot be removed',
};

export class BuildController {
  private currentTool: BuildTool = null;

  /** Acts on `world`; `onMessage` receives a player-facing text for every rejected click. */
  public constructor(
    private world: World,
    private readonly onMessage: (text: string) => void,
  ) {}

  /** The selected tool, or null when none is selected. */
  public get tool(): BuildTool {
    return this.currentTool;
  }

  /** Selects `tool` (null deselects). Call from the build bar or the keyboard. */
  public selectTool(tool: BuildTool): void {
    this.currentTool = tool;
  }

  /** Deselects the tool. Call on Escape or right-click. */
  public cancel(): void {
    this.currentTool = null;
  }

  /** Points the controller at a new world, keeping the tool. Call after "New map". */
  public setWorld(world: World): void {
    this.world = world;
  }

  /** Where the selected building would go on `tile` and whether it fits; null without a build tool or tile. Per frame. */
  public preview(tile: TileCoord | null): PlacementPreview | null {
    const tool = this.currentTool;
    if (!tile || tool?.type !== 'build') return null;
    const { ok } = this.world.canPlace(tool.kind, tile.tx, tile.ty);
    return { kind: tool.kind, tx: tile.tx, ty: tile.ty, ok };
  }

  /** Applies the selected tool to `tile`; null when there is no tool or tile. Reports failures through `onMessage`. */
  public click(tile: TileCoord | null): CommandResult | null {
    const tool = this.currentTool;
    if (!tile || !tool) return null;
    if (tool.type === 'build') {
      const result = this.world.apply({ type: 'placeBuilding', kind: tool.kind, tx: tile.tx, ty: tile.ty });
      if (!result.ok) this.onMessage(`Cannot build: ${REASON_TEXT[result.reason]}`);
      return result;
    }
    const target = this.world.objectAt(tile.tx, tile.ty);
    const result: CommandResult = target
      ? this.world.apply({ type: 'demolish', objectId: target.id })
      : { ok: false, reason: 'UnknownObject' };
    if (!result.ok) this.onMessage(`Cannot demolish: ${REASON_TEXT[result.reason]}`);
    return result;
  }
}
