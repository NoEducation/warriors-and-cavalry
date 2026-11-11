// Internal (low-resolution) render size for a canvas of a given CSS size.

/** Drawing-buffer size for a CSS size divided by `pixelScale`; null when the CSS size is unusable. */
export function renderSize(
  cssWidth: number,
  cssHeight: number,
  pixelScale: number,
): { width: number; height: number } | null {
  if (!Number.isFinite(cssWidth) || !Number.isFinite(cssHeight) || cssWidth <= 0 || cssHeight <= 0) {
    return null;
  }
  return {
    width: Math.max(1, Math.floor(cssWidth / pixelScale)),
    height: Math.max(1, Math.floor(cssHeight / pixelScale)),
  };
}
