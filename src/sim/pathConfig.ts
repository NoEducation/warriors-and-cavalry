// Tunable path-finding numbers.

/** Step costs are integers (straight 10, diagonal 14 ~ 10·√2); `maxExpanded` caps one search's work. */
export const PATH_CONFIG = Object.freeze({ maxExpanded: 65536, straightCost: 10, diagonalCost: 14 });
