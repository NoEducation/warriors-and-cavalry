// Tunable population numbers: job retries and walking speed, all in whole ticks.

/** Frozen so worlds stay reproducible; tune by editing these values here. */
export const POPULATION_CONFIG = Object.freeze({
  /** Ticks a worker whose search failed (its way to work, to storage or to a tree is blocked) waits before searching again. */
  retryTicks: 50,
  /** Peasant `id` waits `id % retrySpread` ticks more, so peasants stranded together do not all search on one tick. */
  retrySpread: 8,
  /** Ticks a workplace with no path from the Keep is skipped before a worker is tried for it again. */
  unreachableSkipTicks: 200,
  /** Ticks for one step to a straight neighbour. */
  straightStepTicks: 4,
  /** Ticks for one step to a diagonal neighbour. */
  diagonalStepTicks: 6,
  /** Ticks a felled tree's stump stands before it is cleared away. */
  stumpTicks: 600,
  /** Rounds of wood (one woodcutter batch each) a tree gives; it falls on the last. */
  treeChops: 4,
});
