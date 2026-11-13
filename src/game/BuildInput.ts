// Player input for building: digit keys, Escape, the build bar and clicks on the map drive a BuildController.
import type { Pointer } from '../input/Pointer';
import type { EconomyView } from '../sim/Economy';
import type { TileCoord } from '../sim/TileCoord';
import type { World } from '../sim/World';
import { BuildBar } from '../ui/BuildBar';
import { BUILD_TOOLS, type BuildTool } from '../ui/BuildTool';
import type { BuildController } from './BuildController';

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

/** What a left click on the map acts on: the current world and the tile under the cursor in it (null for none). */
export interface MapClickTarget {
  readonly world: World;
  readonly tile: TileCoord | null;
}

export class BuildInput {
  private readonly bar: BuildBar;

  /**
   * Builds the bar in `barRoot` and listens for keys on `keyTarget` (usually `window`) and clicks on `pointer`;
   * `clickTarget` returns the world and tile a left click acts on. Create once at setup.
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
    pointer.onClick(this.onClick);
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

  private readonly onKeyDown = (e: Event): void => {
    const { code, repeat } = e as KeyboardEvent;
    if (repeat) return;
    if (code === 'Escape') this.select(null);
    const entry = BUILD_TOOLS.find((t) => t.key === code);
    if (entry) this.select(entry.tool);
  };

  /** Left click applies the tool to the tile under the cursor; right click deselects it. */
  private readonly onClick = (button: number): void => {
    if (button === RIGHT_BUTTON) {
      this.select(null);
    } else if (button === LEFT_BUTTON) {
      const { world, tile } = this.clickTarget();
      this.builder.click(world, tile);
    }
  };
}
