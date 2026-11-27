// Internal (low-resolution) render size for a canvas, and the device-pixel block each low-res pixel covers.

/** Drawing-buffer size in pixels. */
export interface RenderSize {
  readonly width: number;
  readonly height: number;
}

/** Drawing-buffer size for a CSS size divided by `pixelScale`; null when the CSS size is unusable. */
export function renderSize(cssWidth: number, cssHeight: number, pixelScale: number): RenderSize | null {
  if (!Number.isFinite(cssWidth) || !Number.isFinite(cssHeight) || cssWidth <= 0 || cssHeight <= 0) {
    return null;
  }
  return {
    width: Math.max(1, Math.floor(cssWidth / pixelScale)),
    height: Math.max(1, Math.floor(cssHeight / pixelScale)),
  };
}

/**
 * Device pixels covered by one low-res pixel: `pixelScale` CSS pixels rounded to a whole number of
 * device pixels so every block is the same size. A non-finite or non-positive `dpr` counts as 1.
 */
export function devicePixelBlock(pixelScale: number, dpr: number): number {
  return Math.max(1, Math.round(pixelScale * usableDpr(dpr)));
}

/** `dpr` when it is finite and positive, otherwise 1. */
export function usableDpr(dpr: number): number {
  return Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
}
