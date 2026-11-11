// Entry point: builds the scene for a generated map and renders it every frame.
import * as THREE from 'three';
import { generateMap, MAPGEN_CONFIG } from './sim/mapgen';
import { createPixelRenderer, type PixelRenderer } from './render/pixelRenderer';
import { buildTerrainMesh } from './render/terrainMesh';
import { buildWater } from './render/water';

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

  // Temporary fixed camera; replaced by a proper camera controller later.
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
  camera.position.set(64, 70, 150);
  camera.lookAt(64, 0, 64);

  function onResize(): void {
    const size = resize();
    if (!size) return;
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);
  onResize();

  if (import.meta.env.DEV) window.__debug = { renderer };

  function frame(): void {
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

start();
