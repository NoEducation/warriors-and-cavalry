// Tunable population numbers: arrivals, job retries and walking speed, all in whole ticks.

/** Frozen so worlds stay reproducible; tune by editing these values here. */
export const POPULATION_CONFIG = Object.freeze({
  /** Ticks between two arrivals while there is housing and food. */
  arrivalTicks: 50,
  /** Food paid for each arriving peasant. */
  arrivalFoodCost: 5,
  /** Ticks an idle peasant waits before looking for a job again. */
  retryTicks: 50,
  /** Ticks a workplace without a path is skipped by job assignment. */
  unreachableSkipTicks: 200,
  /** Ticks for one step to a straight neighbour. */
  straightStepTicks: 4,
  /** Ticks for one step to a diagonal neighbour. */
  diagonalStepTicks: 6,
});
