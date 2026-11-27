// The player's input: keyboard, pointer and canvas events, turned into building, hover, camera and time actions.
import { Keyboard } from '../input/Keyboard';
import { Pointer } from '../input/Pointer';
import type { CameraRig } from '../render/CameraRig';
import type { PlacementGhost } from '../render/PlacementGhost';
import type { TileHighlight } from '../render/TileHighlight';
import { TilePicker } from '../render/TilePicker';
import type { WallLineGhost } from '../render/WallLineGhost';
import type * as THREE from 'three';
import type { UnitView } from '../sim/UnitView';
import type { World } from '../sim/World';
import type { Hud } from '../ui/Hud';
import { BarracksInput } from './BarracksInput';
import { BuildController } from './BuildController';
import { BuildInput, type MapClickTarget } from './BuildInput';
import { CameraDragInput } from './CameraDragInput';
import { GAME_CONFIG } from './GameConfig';
import { SelectionController } from './SelectionController';
import { SelectionInput } from './SelectionInput';
import type { SimulationRunner } from './SimulationRunner';
import { TileHover } from './TileHover';
import { TimeInput } from './TimeInput';

/** What the input acts on. Game owns all of it; `currentWorld` returns the world shown right now. */
export interface GameInputTargets {
  readonly hud: Hud;
  readonly highlight: TileHighlight;
  readonly ghost: PlacementGhost;
  readonly wallGhost: WallLineGhost;
  readonly rig: CameraRig;
  readonly runner: SimulationRunner;
  readonly currentWorld: () => World;
  /** Where `unit` is drawn this frame, into `out`; false while no unit layer is shown. */
  readonly placeOf: (world: World, unit: UnitView, out: THREE.Vector3) => boolean;
}

export class GameInput {
  /** Held keys; the camera reads them every frame. */
  public readonly keyboard = new Keyboard(window);
  /** Updates the ghosts, highlight and HUD lines; call its `update` every frame. */
  public readonly tileHover: TileHover;
  /** The build bar and build keys; shows which buildings can be paid. */
  public readonly buildInput: BuildInput;
  /** The selected soldiers; the selection rings read it every frame. */
  public readonly selection = new SelectionController();
  /** The Barracks panel; refresh it every frame. */
  public readonly barracks: BarracksInput;
  private readonly selectionInput: SelectionInput;
  private readonly cameraDragInput: CameraDragInput;
  private readonly timeInput: TimeInput;

  /** Listens on `canvas`, the build bar in `buildBarRoot` and `window`, acting on `targets`. Create once at setup. */
  public constructor(
    canvas: HTMLCanvasElement,
    buildBarRoot: HTMLElement,
    private readonly targets: GameInputTargets,
  ) {
    const pointer = new Pointer(canvas);
    const { hud, highlight, ghost, wallGhost, rig, runner } = targets;
    const message = (text: string): void => hud.showMessage(text, GAME_CONFIG.messageSeconds);
    const builder = new BuildController(message);
    this.tileHover = new TileHover(pointer, new TilePicker(), highlight, ghost, wallGhost, hud, builder);
    this.barracks = new BarracksInput(canvas.parentElement ?? document.body, targets.currentWorld, message);
    // Before BuildInput, so a right press that drops a build tool is seen with the tool still chosen.
    this.selectionInput = new SelectionInput(canvas, pointer, window, {
      selection: this.selection,
      barracks: this.barracks,
      builder,
      keyboard: this.keyboard,
      currentWorld: targets.currentWorld,
      camera: () => rig.camera,
      tileUnderCursor: () => this.mapClickTarget().tile,
      placeOf: targets.placeOf,
      onMessage: message,
    });
    this.buildInput = new BuildInput(builder, buildBarRoot, window, pointer, () => this.mapClickTarget());
    this.cameraDragInput = new CameraDragInput(pointer, rig);
    this.timeInput = new TimeInput(window, runner);
    this.listenToCanvas(canvas);
  }

  /** Drops input state that belongs to the old map (a wall drag, the selection, the Barracks panel). Call on a new map. */
  public resetForNewMap(): void {
    this.buildInput.resetForNewMap();
    this.selectionInput.resetForNewMap();
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
