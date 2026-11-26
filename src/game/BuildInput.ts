// Player input for building: tool keys, Escape, the build bar, and clicks and wall drags on the map drive a
// BuildController.
import type { Pointer } from '../input/Pointer';
import type { EconomyView } from '../sim/Economy';
import type { TileCoord } from '../sim/TileCoord';
import type { World } from '../sim/World';
import { BuildBar } from '../ui/BuildBar';
import { BUILD_TOOLS, type BuildTool } from '../ui/BuildTool';
import type { BuildController } from './BuildController';

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

/** What a left press, release or click on the map acts on: the current world and the tile under the cursor in it. */
export interface MapClickTarget {
  readonly world: World;
  readonly tile: TileCoord | null;
}

export class BuildInput {
  private readonly bar: BuildBar;

  /**
   * Builds the bar in `barRoot` and listens for keys on `keyTarget` (usually `window`) and presses, releases, clicks
   * and cancels on `pointer`; `clickTarget` returns the world and tile under the cursor. Create once at setup.
   */
  public constructor(
    private readonly builder: BuildController,
    barRoot: HTMLElement,
    keyTarget: EventTarget,
    pointer: Pointer,
    private readonly clickTarget: () => MapClickTarget,
  ) {
    this.bar = new BuildBar(barRoot, (tool) => this.select(tool));
    keyTarget.addEventListener('keydown', this.onKeyDown);
    pointer.onPress(this.onPress);
    pointer.onRelease(this.onRelease);
    pointer.onClick(this.onClick);
    pointer.onCancel(() => this.builder.cancelWallDrag());
  }

  /** Drops a wall drag in progress, which belongs to the old map. Call when a new map is loaded. */
  public resetForNewMap(): void {
    this.builder.cancelWallDrag();
  }

  /** Dims the build bar buttons whose cost `economy` cannot pay. Cheap; call every frame. */
  public showAffordable(economy: EconomyView): void {
    this.bar.setAffordable(economy);
  }

  /** Selects `tool` (null deselects) in the controller and shows it as active on the bar. */
  private select(tool: BuildTool): void {
    this.builder.selectTool(tool);
    this.bar.setActive(tool);
  }

  /** Tool keys and Escape, without key repeats or Ctrl, Meta or Alt. Escape during a wall drag only cancels it. */
  private readonly onKeyDown = (e: Event): void => {
    const { code, repeat, ctrlKey, metaKey, altKey } = e as KeyboardEvent;
    if (repeat || ctrlKey || metaKey || altKey) return;
    if (code === 'Escape' && !this.builder.cancelWallDrag()) this.select(null);
    const entry = BUILD_TOOLS.find((t) => t.key === code);
    if (entry) this.select(entry.tool);
  };

  /** A left press starts a wall drag with the Wall tool; a right press cancels one, or else deselects the tool. */
  private readonly onPress = (button: number): void => {
    if (button === RIGHT_BUTTON) {
      if (!this.builder.cancelWallDrag()) this.select(null);
    } else if (button === LEFT_BUTTON) {
      this.builder.startWallDrag(this.clickTarget().tile);
    }
  };

  /** A left release builds the wall drag in progress, if any, up to the tile under the cursor or the last one seen. */
  private readonly onRelease = (button: number): void => {
    if (button !== LEFT_BUTTON) return;
    const { world, tile } = this.clickTarget();
    this.builder.finishWallDrag(world, tile);
  };

  /** A left click applies the tool to the tile under the cursor. */
  private readonly onClick = (button: number): void => {
    if (button !== LEFT_BUTTON) return;
    const { world, tile } = this.clickTarget();
    this.builder.click(world, tile);
  };
}
