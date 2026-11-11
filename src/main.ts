// Entry point: builds the scene for a generated map, wires input and the HUD, renders every frame.
import * as THREE from 'three';
import { generateMap, MAPGEN_CONFIG } from './sim/mapgen';
import type { GameMap } from './sim/map';
import { TILE_NAMES } from './sim/tiles';
import { createPixelRenderer, type PixelRenderer } from './render/pixelRenderer';
import { buildTerrainMesh, disposeMesh } from './render/terrainMesh';
import { buildWater } from './render/water';
import { CameraRig } from './render/cameraRig';
import { createKeyState } from './render/keyState';
import { pickTile } from './render/picking';
import { createHighlight } from './render/highlight';
import { createHud } from './render/hud';
import { parseSeed, randomSeed } from './seed';

declare global {
  interface Window {
    __debug?: { renderer: THREE.WebGLRenderer };
  }
}

const MAP_SIZE = 128;
const FPS_SAMPLES = 30;
const FPS_UPDATE_MS = 500;

function showError(message: string): void {
  const el = document.getElementById('error');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

function start(): void {
  const canvas = document.getElementById('game');
  const hudRoot = document.getElementById('hud');
  if (!(canvas instanceof HTMLCanvasElement) || !hudRoot) {
    throw new Error('index.html must contain <canvas id="game"> and <div id="hud">');
  }

  let pixel: PixelRenderer;
  try {
    pixel = createPixelRenderer(canvas);
  } catch (err) {
    console.error(err);
    showError('WebGL is not available in this browser.');
    return;
  }
  const { renderer, resize } = pixel;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b2a38);
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-0.6, 1, -0.4); // shines towards the origin (default target)
  scene.add(sun);

  const highlight = createHighlight();
  scene.add(highlight.object);
  const hud = createHud(hudRoot, () => {
    const seed = randomSeed();
    history.replaceState(null, '', `?seed=${seed}`);
    loadMap(seed);
  });

  let map!: GameMap;
  let terrain: THREE.Mesh | null = null;
  let water: THREE.Mesh | null = null;

  function loadMap(seed: number): void {
    for (const mesh of [terrain, water]) {
      if (!mesh) continue;
      scene.remove(mesh);
      disposeMesh(mesh);
    }
    map = generateMap({ seed, width: MAP_SIZE, height: MAP_SIZE });
    terrain = buildTerrainMesh(map);
    water = buildWater(map, MAPGEN_CONFIG.seaLevel);
    scene.add(terrain, water);
    highlight.hide();
    hud.setSeed(seed);
  }
  loadMap(parseSeed(location.search));

  const rig = new CameraRig(MAP_SIZE, MAP_SIZE);
  const keys = createKeyState(window);

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      rig.zoom(e.deltaY);
    },
    { passive: false },
  );
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Cursor in normalised device coordinates; the canvas is drawn at reduced resolution, so use its CSS box.
  let cursor: { x: number; y: number } | null = null;
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    cursor = {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
    };
  });
  canvas.addEventListener('pointerleave', () => {
    cursor = null;
  });

  function onResize(): void {
    const size = resize();
    if (!size) return;
    rig.setAspect(size.width / size.height);
  }
  window.addEventListener('resize', onResize);
  onResize();

  if (import.meta.env.DEV) window.__debug = { renderer };

  function updateHover(): void {
    const tile = cursor && terrain ? pickTile(cursor.x, cursor.y, rig.camera, terrain, map) : null;
    if (!tile) {
      highlight.hide();
      hud.setTile(null);
      return;
    }
    highlight.show(map, tile.tx, tile.ty);
    const type = map.tileAt(tile.tx, tile.ty);
    const name = type === undefined ? '?' : TILE_NAMES[type];
    hud.setTile({ ...tile, name, height: map.tileHeight(tile.tx, tile.ty) });
  }

  const frameTimes: number[] = [];
  let lastFpsUpdate = 0;
  function updateFps(time: number, dt: number): void {
    if (dt > 0) frameTimes.push(dt);
    if (frameTimes.length > FPS_SAMPLES) frameTimes.shift();
    if (time - lastFpsUpdate < FPS_UPDATE_MS || frameTimes.length === 0) return;
    lastFpsUpdate = time;
    const mean = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    hud.setFps(1 / mean);
  }

  let lastTime: number | null = null;
  function frame(time: number): void {
    const dt = lastTime === null ? 0 : (time - lastTime) / 1000;
    lastTime = time;
    rig.update(dt, keys);
    updateHover();
    updateFps(time, dt);
    renderer.render(scene, rig.camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

start();
