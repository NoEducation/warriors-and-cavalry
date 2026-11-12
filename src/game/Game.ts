// Owns every game object and runs the frame loop.
import type * as THREE from 'three';
import { Keyboard } from '../input/Keyboard';
import { Pointer } from '../input/Pointer';
import { CameraRig } from '../render/CameraRig';
import { PixelRenderer } from '../render/PixelRenderer';
import { TileHighlight } from '../render/TileHighlight';
import { TilePicker } from '../render/TilePicker';
import { WorldView } from '../render/WorldView';
import type { GameMap } from '../sim/GameMap';
import { MapGenerator } from '../sim/MapGenerator';
import { Hud } from '../ui/Hud';
import { FpsCounter } from './FpsCounter';
import { GAME_CONFIG } from './GameConfig';
import { parseSeed, randomSeed } from './seed';
import { TileHover } from './TileHover';

/** Handles exposed on `window.__debug` in dev builds, for the browser console. */
export interface DebugHandles {
  readonly renderer: THREE.WebGLRenderer;
  readonly game: Game;
}

declare global {
  interface Window {
    __debug?: DebugHandles;
  }
}

export class Game {
  private readonly pixelRenderer: PixelRenderer;
  private readonly worldView: WorldView;
  private readonly highlight: TileHighlight;
  private readonly hud: Hud;
  private readonly mapGenerator = new MapGenerator();
  private readonly rig: CameraRig;
  private readonly keyboard: Keyboard;
  private readonly tileHover: TileHover;
  private readonly fpsCounter = new FpsCounter(GAME_CONFIG.fpsSamples);
  /** Set by `loadMap`, which the constructor calls. */
  private map!: GameMap;
  private lastFrameTime: number | null = null;
  private lastFpsUpdate = 0;

  /** Builds the scene, HUD and input for the map in the URL's `seed`. Throws if WebGL is unavailable. */
  public constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement) {
    this.pixelRenderer = new PixelRenderer(canvas, GAME_CONFIG.pixelScale);
    this.worldView = new WorldView();
    this.highlight = new TileHighlight();
    this.worldView.scene.add(this.highlight.object);
    this.hud = new Hud(hudRoot, () => this.onNewMap());

    this.loadMap(parseSeed(location.search));

    this.rig = new CameraRig(GAME_CONFIG.mapSize, GAME_CONFIG.mapSize);
    this.keyboard = new Keyboard(window);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.tileHover = new TileHover(new Pointer(canvas), new TilePicker(), this.highlight, this.hud);
  }

  /** Sizes the renderer, follows window resizes and starts the frame loop. Call once after construction. */
  public start(): void {
    window.addEventListener('resize', this.onResize);
    this.onResize();
    if (import.meta.env.DEV) window.__debug = { renderer: this.pixelRenderer.webgl, game: this };
    requestAnimationFrame(this.onFrame);
  }

  /** Generates the map for `seed` and shows it, replacing the current one. */
  public loadMap(seed: number): void {
    this.map = this.mapGenerator.generate({ seed, width: GAME_CONFIG.mapSize, height: GAME_CONFIG.mapSize });
    this.worldView.showMap(this.map);
    this.highlight.hide();
    this.hud.setSeed(seed);
  }

  private update(dtSeconds: number): void {
    this.rig.update(dtSeconds, this.keyboard);
    this.tileHover.update(this.rig.camera, this.worldView.terrain, this.map);
    this.fpsCounter.addFrame(dtSeconds);
  }

  private render(): void {
    this.pixelRenderer.render(this.worldView.scene, this.rig.camera);
  }

  /** Shows the FPS reading at most every `fpsUpdateMs`. */
  private updateFpsDisplay(time: number): void {
    const fps = this.fpsCounter.fps;
    if (time - this.lastFpsUpdate < GAME_CONFIG.fpsUpdateMs || fps === null) return;
    this.lastFpsUpdate = time;
    this.hud.setFps(fps);
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
    this.update(dt);
    this.updateFpsDisplay(time);
    this.render();
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
