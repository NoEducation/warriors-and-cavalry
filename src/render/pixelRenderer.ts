// WebGL renderer that draws at a reduced resolution; CSS scales the canvas up with blocky pixels.
import * as THREE from 'three';
import { renderSize } from './renderSize';

/** CSS pixels per rendered pixel. */
export const PIXEL_SCALE = 3;

export interface PixelRenderer {
  renderer: THREE.WebGLRenderer;
  /** Matches the drawing buffer to the canvas CSS size; null when the canvas has no usable size. */
  resize(): { width: number; height: number } | null;
}

/** Throws if WebGL is unavailable. */
export function createPixelRenderer(canvas: HTMLCanvasElement): PixelRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);

  function resize(): { width: number; height: number } | null {
    const size = renderSize(canvas.clientWidth, canvas.clientHeight, PIXEL_SCALE);
    if (size) renderer.setSize(size.width, size.height, false);
    return size;
  }

  return { renderer, resize };
}
