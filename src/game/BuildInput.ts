// Player input for building: digit keys, Escape, the build bar and clicks on the map drive a BuildController.
import type { Pointer } from '../input/Pointer';
import type { TileCoord } from '../sim/TileCoord';
import { BuildBar } from '../ui/BuildBar';
import type { BuildController } from './BuildController';
import { BUILD_TOOLS, type BuildTool } from './BuildTool';

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

export class BuildInput {
  private readonly bar: BuildBar;

  /**
   * Builds the bar in `barRoot` and listens for keys on `keyTarget` (usually `window`) and clicks on `pointer`;
   * `tileUnderCursor` returns the tile a left click acts on. Create once at setup.
   */
  public constructor(
    private readonly builder: BuildController,
    barRoot: HTMLElement,
    keyTarget: EventTarget,
    pointer: Pointer,
    private readonly tileUnderCursor: () => TileCoord | null,
  ) {
    this.bar = new BuildBar(barRoot, (tool) => this.select(tool));
    keyTarget.addEventListener('keydown', this.onKeyDown);
    pointer.onClick(this.onClick);
  }

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

  /** Left click applies the tool to the tile under the cursor; right click cancels it. */
  private readonly onClick = (button: number): void => {
    if (button === RIGHT_BUTTON) this.select(null);
    else if (button === LEFT_BUTTON) this.builder.click(this.tileUnderCursor());
  };
}
