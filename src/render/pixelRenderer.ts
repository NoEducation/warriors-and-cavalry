// WebGL renderer that draws at a reduced resolution; CSS scales the canvas up with blocky pixels.
import * as THREE from 'three';
import { devicePixelBlock, renderSize, usableDpr } from './renderSize';

/** CSS pixels per rendered pixel (rounded to whole device pixels at runtime). */
export const PIXEL_SCALE = 3;

export interface PixelRenderer {
  renderer: THREE.WebGLRenderer;
  /** Matches the drawing buffer to the canvas size in device pixels; null when the canvas has no usable size. */
  resize(): { width: number; height: number } | null;
}

/** Throws if WebGL is unavailable. */
export function createPixelRenderer(canvas: HTMLCanvasElement): PixelRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);

  function resize(): { width: number; height: number } | null {
    // Size in device pixels so each low-res pixel covers a whole number of them, even at a fractional DPR.
    const dpr = usableDpr(window.devicePixelRatio);
    const block = devicePixelBlock(PIXEL_SCALE, dpr);
    const size = renderSize(canvas.clientWidth * dpr, canvas.clientHeight * dpr, block);
    if (size) renderer.setSize(size.width, size.height, false);
    return size;
  }

  return { renderer, resize };
}
