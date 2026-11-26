// Owns every game object and the current world, and runs the frame loop.
import { BuildingMeshFactory } from '../render/BuildingMeshFactory';
import { CameraRig } from '../render/CameraRig';
import { groundHeightAt } from '../render/groundHeightAt';
import { PixelRenderer } from '../render/PixelRenderer';
import { PlacementGhost } from '../render/PlacementGhost';
import { TileHighlight } from '../render/TileHighlight';
import { WallLineGhost } from '../render/WallLineGhost';
import { WorldView } from '../render/WorldView';
import { TICKS_PER_SECOND } from '../sim/gameTime';
import type { World } from '../sim/World';
import { Hud } from '../ui/Hud';
import { ResourceBar } from '../ui/ResourceBar';
import { FpsDisplay } from './FpsDisplay';
import type { GameElements, WorldSource } from './GameElements';
import { GAME_CONFIG } from './GameConfig';
import { GameInput } from './GameInput';
import { randomSeed, writeSeedToUrl } from './seed';
import { SimulationRunner } from './SimulationRunner';
import { StatusDisplay } from './StatusDisplay';
import type { LoadedWorld } from './WorldAssembler';

/** The status widgets the frame loop refreshes. */
interface GameWidgets {
  readonly fpsDisplay: FpsDisplay;
  readonly status: StatusDisplay;
}

export class Game {
  private readonly worldView = new WorldView();
  private readonly highlight = new TileHighlight();
  private readonly ghostFactory = new BuildingMeshFactory();
  private readonly ghost = new PlacementGhost(this.ghostFactory);
  private readonly wallGhost = new WallLineGhost(this.ghostFactory);
  private readonly rig = new CameraRig(GAME_CONFIG.mapSize, GAME_CONFIG.mapSize);
  private readonly runner = new SimulationRunner(TICKS_PER_SECOND);
  private readonly pixelRenderer: PixelRenderer;
  private readonly hud: Hud;
  private readonly input: GameInput;
  private readonly widgets: GameWidgets;
  /** The world currently shown. Game is its only owner and passes it to whoever needs it; `loadMap` replaces it. */
  private world: World;
  private lastFrameTime: number | null = null;
  /** True while a new map is being loaded; "New map" is ignored meanwhile. */
  private loading = false;

  /**
   * Builds the scene, HUD, resource bar, build bar and input, showing `first`; later maps come from `loadWorld`.
   * Throws without WebGL.
   */
  public constructor(
    elements: GameElements,
    first: LoadedWorld,
    private readonly loadWorld: WorldSource,
  ) {
    const { canvas, hudRoot, resourceRoot, buildBarRoot } = elements;
    this.pixelRenderer = new PixelRenderer(canvas, GAME_CONFIG.pixelScale);
    this.world = first.world;
    this.hud = new Hud(hudRoot, () => this.onNewMap());
    this.input = this.createInput(canvas, buildBarRoot);
    this.widgets = this.createWidgets(resourceRoot);
    // The hover outline and the ghosts stay in the scene across maps.
    this.worldView.scene.add(this.highlight.object, this.ghost.object, this.wallGhost.object);
    this.showWorld(first);
  }

  /** Sizes the renderer, follows window resizes and starts the frame loop. Call once after construction. */
  public start(): void {
    window.addEventListener('resize', this.onResize);
    this.onResize();
    if (import.meta.env.DEV) this.exposeDebugHandles();
    requestAnimationFrame(this.onFrame);
  }

  /**
   * Loads the world for `seed` through the world source and shows it, replacing the current one, which keeps running
   * until then. Build tool, pause and speed are kept; a wall drag in progress is dropped. Ignored while a load runs.
   */
  public async loadMap(seed: number): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      await this.loadWorld(seed, (loaded) => {
        this.world = loaded.world;
        this.input.resetForNewMap();
        this.runner.reset();
        this.showWorld(loaded);
      });
    } finally {
      this.loading = false;
    }
  }

  /** Creates the keyboard, pointer and canvas input, acting on the HUD, hover outline, ghosts, camera and runner. */
  private createInput(canvas: HTMLCanvasElement, buildBarRoot: HTMLElement): GameInput {
    const { hud, highlight, ghost, wallGhost, rig, runner } = this;
    const currentWorld = (): World => this.world;
    return new GameInput(canvas, buildBarRoot, { hud, highlight, ghost, wallGhost, rig, runner, currentWorld });
  }

  /** Creates the FPS reading and the clock, resource bar and affordability display. Call after `createInput`. */
  private createWidgets(resourceRoot: HTMLElement): GameWidgets {
    return {
      fpsDisplay: new FpsDisplay(this.hud, GAME_CONFIG.fpsSamples, GAME_CONFIG.fpsUpdateMs),
      status: new StatusDisplay(this.hud, new ResourceBar(resourceRoot), this.input.buildInput, this.runner),
    };
  }

  /** Shows `this.world`, with the terrain data `loaded` came with, in the scene and its seed on the HUD. */
  private showWorld(loaded: LoadedWorld): void {
    this.worldView.showWorld(this.world, loaded.terrain);
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
    if (this.loading) return;
    const seed = randomSeed();
    writeSeedToUrl(seed);
    void this.loadMap(seed);
  }

  private readonly onFrame = (time: number): void => {
    // Frame order: ticks → camera → hover → world view update (at the tick fraction) → status → FPS → render.
    const dt = this.lastFrameTime === null ? 0 : (time - this.lastFrameTime) / 1000;
    this.lastFrameTime = time;
    for (let ticks = this.runner.ticksFor(dt); ticks > 0; ticks--) this.world.tick();
    this.rig.update(dt, this.input.keyboard);
    this.rig.followGround((x, z) => groundHeightAt(this.world.map, x, z), dt);
    this.input.tileHover.update(this.rig.camera, this.world);
    this.worldView.update(this.world, this.runner.tickFraction);
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
