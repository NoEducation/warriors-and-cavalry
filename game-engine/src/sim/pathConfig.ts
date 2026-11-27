// Tunable path-finding numbers.

/**
 * Step costs are integers (straight 10, diagonal 14 ~ 10·√2); `maxExpanded` caps one search's work, and
 * `treeSearchMaxExpanded` the work of a woodcutter's search for a tree near its hut (a tree it cannot reach within
 * that many tiles counts as out of reach, so trees on an island cost little to give up on).
 */
export const PATH_CONFIG = Object.freeze({
  maxExpanded: 65536,
  treeSearchMaxExpanded: 4096,
  straightCost: 10,
  diagonalCost: 14,
});
