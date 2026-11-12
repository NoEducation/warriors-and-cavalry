// Game-wide settings, in one frozen object.

export const GAME_CONFIG = Object.freeze({
  /** Map width and height in tiles. */
  mapSize: 512,
  /** CSS pixels per rendered pixel (rounded to whole device pixels at runtime). */
  pixelScale: 3,
  /** Frames averaged for the FPS reading. */
  fpsSamples: 60,
  /** Milliseconds between FPS display updates. */
  fpsUpdateMs: 500,
  /** Seconds a HUD message (e.g. a rejected placement) stays visible. */
  messageSeconds: 2,
});
