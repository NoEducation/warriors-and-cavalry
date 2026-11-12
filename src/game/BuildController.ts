// Turns the selected build tool and clicked tile into World commands. No DOM, no three.js.
import type { PlacementPreview } from '../sim/PlacementPreview';
import type { TileCoord } from '../sim/TileCoord';
import type { World } from '../sim/World';
import type { CommandResult } from '../sim/WorldCommand';
import type { BuildTool } from './BuildTool';

type FailureReason = Extract<CommandResult, { ok: false }>['reason'];

const REASON_TEXT: Record<FailureReason, string> = {
  NotBuildable: 'not buildable',
  OutOfBounds: 'out of bounds',
  BadTerrain: 'bad terrain',
  Occupied: 'occupied',
  TooSteep: 'too steep',
  NeedsRock: 'needs rock nearby',
  NotEnoughResources: 'not enough resources',
  UnknownObject: 'nothing here',
  NotDemolishable: 'trees cannot be removed',
  UnknownCommand: 'unknown command',
};

export class BuildController {
  private currentTool: BuildTool = null;

  /**
   * Holds no world: `preview` and `click` get the world to act on with every call.
   * `onMessage` receives a player-facing text for every rejected click.
   */
  public constructor(private readonly onMessage: (text: string) => void) {}

  /** The selected tool, or null when none is selected. */
  public get tool(): BuildTool {
    return this.currentTool;
  }

  /** Selects `tool`; null deselects. Call from the build bar, digit keys, Escape or right-click. */
  public selectTool(tool: BuildTool): void {
    this.currentTool = tool;
  }

  /**
   * Where the selected building would go on `tile` of `world` and whether it fits; null without a build tool or tile.
   * Call per frame.
   */
  public preview(world: World, tile: TileCoord | null): PlacementPreview | null {
    const tool = this.currentTool;
    if (!tile || tool?.type !== 'build') return null;
    const { ok } = world.canPlace(tool.kind, tile.tx, tile.ty);
    return { kind: tool.kind, tx: tile.tx, ty: tile.ty, ok };
  }

  /**
   * Applies the selected tool to `tile` of `world`; null when there is no tool or tile.
   * Reports failures through `onMessage`. Call on a left click on the map.
   */
  public click(world: World, tile: TileCoord | null): CommandResult | null {
    const tool = this.currentTool;
    if (!tile || !tool) return null;
    if (tool.type === 'build') {
      const result = world.apply({ type: 'placeBuilding', kind: tool.kind, tx: tile.tx, ty: tile.ty });
      if (!result.ok) this.onMessage(`Cannot build: ${REASON_TEXT[result.reason]}`);
      return result;
    }
    const target = world.objectAt(tile.tx, tile.ty);
    const result: CommandResult = target
      ? world.apply({ type: 'demolish', objectId: target.id })
      : { ok: false, reason: 'UnknownObject' };
    if (!result.ok) this.onMessage(`Cannot demolish: ${REASON_TEXT[result.reason]}`);
    return result;
  }
}
