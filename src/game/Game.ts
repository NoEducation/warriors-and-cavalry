// Owns every game object and the current world, and runs the frame loop.
import { Keyboard } from '../input/Keyboard';
import { Pointer } from '../input/Pointer';
import { BuildingMeshFactory } from '../render/BuildingMeshFactory';
import { CameraRig } from '../render/CameraRig';
import { PixelRenderer } from '../render/PixelRenderer';
import { PlacementGhost } from '../render/PlacementGhost';
import { TileHighlight } from '../render/TileHighlight';
import { TilePicker } from '../render/TilePicker';
import { WorldView } from '../render/WorldView';
import { gameTimeAt, TICKS_PER_SECOND } from '../sim/gameTime';
import { MapGenerator } from '../sim/MapGenerator';
import type { World } from '../sim/World';
import { Hud } from '../ui/Hud';
import { BuildController } from './BuildController';
import { BuildInput, type MapClickTarget } from './BuildInput';
import { CameraDragInput } from './CameraDragInput';
import { FpsDisplay } from './FpsDisplay';
import { GAME_CONFIG } from './GameConfig';
import { parseSeed, randomSeed } from './seed';
import { SimulationRunner } from './SimulationRunner';
import { TileHover } from './TileHover';
import { TimeInput } from './TimeInput';

export class Game {
  private readonly mapGenerator = new MapGenerator();
  private readonly worldView = new WorldView();
  private readonly highlight = new TileHighlight();
  private readonly ghost = new PlacementGhost(new BuildingMeshFactory());
  private readonly picker = new TilePicker();
  private readonly rig = new CameraRig(GAME_CONFIG.mapSize, GAME_CONFIG.mapSize);
  private readonly runner = new SimulationRunner(TICKS_PER_SECOND);
  private readonly pixelRenderer: PixelRenderer;
  private readonly keyboard: Keyboard;
  private readonly pointer: Pointer;
  private readonly hud: Hud;
  private readonly fpsDisplay: FpsDisplay;
  private readonly builder: BuildController;
  private readonly tileHover: TileHover;
  private readonly buildInput: BuildInput;
  private readonly cameraDragInput: CameraDragInput;
  private readonly timeInput: TimeInput;
  /** The world currently shown. Game is its only owner and passes it to whoever needs it; `loadMap` replaces it. */
  private world: World;
  private lastFrameTime: number | null = null;

  /** Builds the scene, HUD, build bar and input for the map in the URL's `seed`. Throws if WebGL is unavailable. */
  public constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement, buildBarRoot: HTMLElement) {
    this.pixelRenderer = new PixelRenderer(canvas, GAME_CONFIG.pixelScale);
    this.world = this.generateWorld(parseSeed(location.search));
    this.keyboard = new Keyboard(window);
    this.pointer = new Pointer(canvas);
    this.hud = new Hud(hudRoot, () => this.onNewMap());
    this.fpsDisplay = new FpsDisplay(this.hud, GAME_CONFIG.fpsSamples, GAME_CONFIG.fpsUpdateMs);
    this.builder = new BuildController((text) => this.hud.showMessage(text, GAME_CONFIG.messageSeconds));
    this.tileHover = new TileHover(this.pointer, this.picker, this.highlight, this.ghost, this.hud, this.builder);
    this.buildInput = new BuildInput(this.builder, buildBarRoot, window, this.pointer, () => this.mapClickTarget());
    this.cameraDragInput = new CameraDragInput(this.pointer, this.rig);
    this.timeInput = new TimeInput(window, this.runner);
    // The hover outline and placement ghost stay in the scene across maps.
    this.worldView.scene.add(this.highlight.object, this.ghost.object);
    this.listenToCanvas(canvas);
    this.showWorld();
  }

  /** Sizes the renderer, follows window resizes and starts the frame loop. Call once after construction. */
  public start(): void {
    window.addEventListener('resize', this.onResize);
    this.onResize();
    if (import.meta.env.DEV) this.exposeDebugHandles();
    requestAnimationFrame(this.onFrame);
  }

  /** Generates the world for `seed` and shows it, replacing the current one. Build tool, pause and speed are kept. */
  public loadMap(seed: number): void {
    this.world = this.generateWorld(seed);
    this.runner.reset();
    this.showWorld();
  }

  private generateWorld(seed: number): World {
    return this.mapGenerator.generate({ seed, width: GAME_CONFIG.mapSize, height: GAME_CONFIG.mapSize });
  }

  /** Shows `this.world` in the scene and its seed on the HUD. */
  private showWorld(): void {
    this.worldView.showWorld(this.world);
    this.highlight.hide();
    this.hud.setSeed(this.world.map.seed);
  }

  /** Mouse wheel zooms; the browser's context menu is suppressed so right-click can deselect the build tool. */
  private listenToCanvas(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private mapClickTarget(): MapClickTarget {
    return { world: this.world, tile: this.tileHover.tileUnderCursor(this.rig.camera, this.world.map) };
  }

  private exposeDebugHandles(): void {
    const game = this;
    window.__debug = {
      renderer: this.pixelRenderer.webgl,
      game,
      runner: this.runner,
      get world(): World {
        return game.world;
      },
    };
  }

  private onNewMap(): void {
    const seed = randomSeed();
    const url = new URL(location.href);
    url.searchParams.set('seed', String(seed));
    history.replaceState(null, '', url);
    this.loadMap(seed);
  }

  private readonly onFrame = (time: number): void => {
    const dt = this.lastFrameTime === null ? 0 : (time - this.lastFrameTime) / 1000;
    this.lastFrameTime = time;
    for (let ticks = this.runner.ticksFor(dt); ticks > 0; ticks--) this.world.tick();
    this.hud.setClock(gameTimeAt(this.world.tickCount), this.runner.paused, this.runner.speed);
    this.rig.update(dt, this.keyboard);
    this.tileHover.update(this.rig.camera, this.world);
    this.fpsDisplay.addFrame(dt, time);
    this.pixelRenderer.render(this.worldView.scene, this.rig.camera);
    requestAnimationFrame(this.onFrame);
  };

  private readonly onResize = (): void => {
    const size = this.pixelRenderer.resize();
    if (!size) return;
    this.rig.setAspect(size.width / size.height);
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.rig.zoom(e.deltaY);
  };
}
