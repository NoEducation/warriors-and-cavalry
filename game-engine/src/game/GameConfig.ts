// Game-wide settings, in one frozen object.

export const GAME_CONFIG = Object.freeze({
  /** Map width and height in tiles. */
  mapSize: 512,
  /** CSS pixels per rendered pixel (rounded to whole device pixels at runtime). */
  pixelScale: 2,
  /** Frames averaged for the FPS reading. */
  fpsSamples: 60,
  /** Milliseconds between FPS display updates. */
  fpsUpdateMs: 500,
  /** Seconds a HUD message (e.g. a rejected placement) stays visible. */
  messageSeconds: 2,
  /** Seed of the map shown when the URL names none (or an invalid one). */
  defaultSeed: 1,
  /** Speed multipliers the player can step through, slowest first. */
  simulationSpeeds: Object.freeze([1, 2, 4] as const),
  /** Most ticks run in one frame; time beyond that (a long stall, a hidden tab) is dropped. */
  maxTicksPerFrame: 10,
});
