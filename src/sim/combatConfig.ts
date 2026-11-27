// Tunable combat numbers: peasants' hit points, training, chasing and raid waves, all in whole ticks and tiles.

/** Frozen so worlds stay reproducible; tune by editing these values here. */
export const COMBAT_CONFIG = Object.freeze({
  /** Hit points of a peasant (workers do not fight back). */
  peasantHitPoints: 20,
  /** Soldiers one Barracks may have queued at once. */
  queueLimit: 5,
  /** A unit chasing a moving target searches again at most once every this many ticks. */
  chaseReplanTicks: 10,
  /** Extra reach of an Archer standing on a wall or tower top. */
  wallTopReachBonus: 2,
  /** Ticks of a Keep standing before the first raider wave. */
  firstWaveTicks: 3000,
  /** Ticks between one wave and the next. */
  waveIntervalTicks: 1800,
  /** Tiles from the Keep's centre where a wave appears. */
  spawnDistance: 48,
});
