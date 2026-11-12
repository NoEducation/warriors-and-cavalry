// WebGL renderer that draws at a reduced resolution; CSS scales the canvas up with blocky pixels.
import * as THREE from 'three';
import { devicePixelBlock, renderSize, usableDpr, type RenderSize } from './renderSize';

export class PixelRenderer {
  public readonly webgl: THREE.WebGLRenderer;

  /** `pixelScale` is CSS pixels per rendered pixel. Throws if WebGL is unavailable. */
  public constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly pixelScale: number,
  ) {
    this.webgl = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.webgl.setPixelRatio(1);
  }

  /**
   * Matches the drawing buffer to the canvas size in device pixels. Call on start and on every window resize.
   * Returns the new size, or null when the canvas has no usable size.
   */
  public resize(): RenderSize | null {
    // Size in device pixels so each low-res pixel covers a whole number of them, even at a fractional DPR.
    const dpr = usableDpr(window.devicePixelRatio);
    const block = devicePixelBlock(this.pixelScale, dpr);
    const size = renderSize(this.canvas.clientWidth * dpr, this.canvas.clientHeight * dpr, block);
    if (size) this.webgl.setSize(size.width, size.height, false);
    return size;
  }

  /** Draws `scene` from `camera`. Call once per frame. */
  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.webgl.render(scene, camera);
  }
}
