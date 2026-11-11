// Entry point: builds the scene for a generated map and renders it every frame.
import * as THREE from 'three';
import { generateMap, MAPGEN_CONFIG } from './sim/mapgen';
import { createPixelRenderer, type PixelRenderer } from './render/pixelRenderer';
import { buildTerrainMesh } from './render/terrainMesh';
import { buildWater } from './render/water';
import { CameraRig } from './render/cameraRig';
import { createKeyState } from './render/keyState';

declare global {
  interface Window {
    __debug?: { renderer: THREE.WebGLRenderer };
  }
}

function showError(message: string): void {
  const el = document.getElementById('error');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

function start(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement;

  let pixel: PixelRenderer;
  try {
    pixel = createPixelRenderer(canvas);
  } catch {
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

  const map = generateMap({ seed: 1, width: 128, height: 128 });
  scene.add(buildTerrainMesh(map));
  scene.add(buildWater(map, MAPGEN_CONFIG.seaLevel));

  const rig = new CameraRig(map.width, map.height);
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

  function onResize(): void {
    const size = resize();
    if (!size) return;
    rig.setAspect(size.width / size.height);
  }
  window.addEventListener('resize', onResize);
  onResize();

  if (import.meta.env.DEV) window.__debug = { renderer };

  let lastTime: number | null = null;
  function frame(time: number): void {
    const dt = lastTime === null ? 0 : (time - lastTime) / 1000;
    lastTime = time;
    rig.update(dt, keys);
    renderer.render(scene, rig.camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

start();
