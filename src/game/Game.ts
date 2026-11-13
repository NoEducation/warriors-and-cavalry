// Owns every game object and the current world, and runs the frame loop.
import { BuildingMeshFactory } from '../render/BuildingMeshFactory';
import { CameraRig } from '../render/CameraRig';
import { PixelRenderer } from '../render/PixelRenderer';
import { PlacementGhost } from '../render/PlacementGhost';
import { TileHighlight } from '../render/TileHighlight';
import { WorldView } from '../render/WorldView';
import { TICKS_PER_SECOND } from '../sim/gameTime';
import { MapGenerator } from '../sim/MapGenerator';
import type { World } from '../sim/World';
import { Hud } from '../ui/Hud';
import { ResourceBar } from '../ui/ResourceBar';
import { FpsDisplay } from './FpsDisplay';
import { GAME_CONFIG } from './GameConfig';
import { GameInput } from './GameInput';
import { parseSeed, randomSeed } from './seed';
import { SimulationRunner } from './SimulationRunner';
import { StatusDisplay } from './StatusDisplay';

/** The status widgets the frame loop refreshes. */
interface GameWidgets {
  readonly fpsDisplay: FpsDisplay;
  readonly status: StatusDisplay;
}

export class Game {
  private readonly mapGenerator = new MapGenerator();
  private readonly worldView = new WorldView();
  private readonly highlight = new TileHighlight();
  private readonly ghost = new PlacementGhost(new BuildingMeshFactory());
  private readonly rig = new CameraRig(GAME_CONFIG.mapSize, GAME_CONFIG.mapSize);
  private readonly runner = new SimulationRunner(TICKS_PER_SECOND);
  private readonly pixelRenderer: PixelRenderer;
  private readonly hud: Hud;
  private readonly input: GameInput;
  private readonly widgets: GameWidgets;
  /** The world currently shown. Game is its only owner and passes it to whoever needs it; `loadMap` replaces it. */
  private world: World;
  private lastFrameTime: number | null = null;

  /** Builds the scene, HUD, resource bar, build bar and input for the URL's `seed`. Throws without WebGL. */
  public constructor(
    canvas: HTMLCanvasElement,
    hudRoot: HTMLElement,
    resourceRoot: HTMLElement,
    buildBarRoot: HTMLElement,
  ) {
    this.pixelRenderer = new PixelRenderer(canvas, GAME_CONFIG.pixelScale);
    this.world = this.generateWorld(parseSeed(location.search));
    this.hud = new Hud(hudRoot, () => this.onNewMap());
    this.input = this.createInput(canvas, buildBarRoot);
    this.widgets = this.createWidgets(resourceRoot);
    // The hover outline and placement ghost stay in the scene across maps.
    this.worldView.scene.add(this.highlight.object, this.ghost.object);
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

  /** Creates the keyboard, pointer and canvas input, acting on the HUD, hover outline, ghost, camera and runner. */
  private createInput(canvas: HTMLCanvasElement, buildBarRoot: HTMLElement): GameInput {
    const { hud, highlight, ghost, rig, runner } = this;
    return new GameInput(canvas, buildBarRoot, { hud, highlight, ghost, rig, runner, currentWorld: () => this.world });
  }

  /** Creates the FPS reading and the clock, resource bar and affordability display. Call after `createInput`. */
  private createWidgets(resourceRoot: HTMLElement): GameWidgets {
    return {
      fpsDisplay: new FpsDisplay(this.hud, GAME_CONFIG.fpsSamples, GAME_CONFIG.fpsUpdateMs),
      status: new StatusDisplay(this.hud, new ResourceBar(resourceRoot), this.input.buildInput, this.runner),
    };
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
    // Frame order: ticks → camera → hover → world view update → status (clock, resources, FPS) → render.
    const dt = this.lastFrameTime === null ? 0 : (time - this.lastFrameTime) / 1000;
    this.lastFrameTime = time;
    for (let ticks = this.runner.ticksFor(dt); ticks > 0; ticks--) this.world.tick();
    this.rig.update(dt, this.input.keyboard);
    this.input.tileHover.update(this.rig.camera, this.world);
    this.worldView.update();
    this.widgets.status.update(this.world);
    this.widgets.fpsDisplay.addFrame(dt, time);
    this.pixelRenderer.render(this.worldView.scene, this.rig.camera);
    requestAnimationFrame(this.onFrame);
  };

  private readonly onResize = (): void => {
    const size = this.pixelRenderer.resize();
    if (size) this.rig.setAspect(size.width / size.height);
  };
}
