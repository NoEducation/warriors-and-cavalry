// The player's input: keyboard, pointer and canvas events, turned into building, hover, camera and time actions.
import { Keyboard } from '../input/Keyboard';
import { Pointer } from '../input/Pointer';
import type { CameraRig } from '../render/CameraRig';
import type { PlacementGhost } from '../render/PlacementGhost';
import type { TileHighlight } from '../render/TileHighlight';
import { TilePicker } from '../render/TilePicker';
import type { World } from '../sim/World';
import type { Hud } from '../ui/Hud';
import { BuildController } from './BuildController';
import { BuildInput, type MapClickTarget } from './BuildInput';
import { CameraDragInput } from './CameraDragInput';
import { GAME_CONFIG } from './GameConfig';
import type { SimulationRunner } from './SimulationRunner';
import { TileHover } from './TileHover';
import { TimeInput } from './TimeInput';

/** What the input acts on. Game owns all of it; `currentWorld` returns the world shown right now. */
export interface GameInputTargets {
  readonly hud: Hud;
  readonly highlight: TileHighlight;
  readonly ghost: PlacementGhost;
  readonly rig: CameraRig;
  readonly runner: SimulationRunner;
  readonly currentWorld: () => World;
}

export class GameInput {
  /** Held keys; the camera reads them every frame. */
  public readonly keyboard = new Keyboard(window);
  /** Updates the ghost, highlight and HUD tile line; call its `update` every frame. */
  public readonly tileHover: TileHover;
  /** The build bar and build keys; shows which buildings can be paid. */
  public readonly buildInput: BuildInput;
  private readonly cameraDragInput: CameraDragInput;
  private readonly timeInput: TimeInput;

  /** Listens on `canvas`, the build bar in `buildBarRoot` and `window`, acting on `targets`. Create once at setup. */
  public constructor(
    canvas: HTMLCanvasElement,
    buildBarRoot: HTMLElement,
    private readonly targets: GameInputTargets,
  ) {
    const pointer = new Pointer(canvas);
    const { hud, highlight, ghost, rig, runner } = targets;
    const builder = new BuildController((text) => hud.showMessage(text, GAME_CONFIG.messageSeconds));
    this.tileHover = new TileHover(pointer, new TilePicker(), highlight, ghost, hud, builder);
    this.buildInput = new BuildInput(builder, buildBarRoot, window, pointer, () => this.mapClickTarget());
    this.cameraDragInput = new CameraDragInput(pointer, rig);
    this.timeInput = new TimeInput(window, runner);
    this.listenToCanvas(canvas);
  }

  /** Mouse wheel zooms; the browser's context menu is suppressed so right-click can deselect the build tool. */
  private listenToCanvas(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private mapClickTarget(): MapClickTarget {
    const world = this.targets.currentWorld();
    return { world, tile: this.tileHover.tileUnderCursor(this.targets.rig.camera, world.map) };
  }

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.targets.rig.zoom(e.deltaY);
  };
}
