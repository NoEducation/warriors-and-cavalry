// Which steps a walker may take: tiles are ground, stairs, a wall top or blocked, and the walk's mode decides whether
// it may climb onto the wall walk or drop off it. Pure, so the path-finder and the walker apply the same rule.

/** What a tile is to a walker: blocked, ground, stairs (joining ground and wall walk), or a wall or tower top. */
export const WalkClass = { Blocked: 0, Ground: 1, Stairs: 2, Top: 3 } as const;
export type WalkClass = (typeof WalkClass)[keyof typeof WalkClass];

/**
 * How a walk may use the wall walk: `Ground` trips may walk along it and down stairs but never climb up; `Climb` may
 * also go up stairs onto it; `Down` is a ground trip that may also step straight off a wall top onto the ground (for a
 * walker stranded up there).
 */
export const WalkMode = { Ground: 0, Climb: 1, Down: 2 } as const;
export type WalkMode = (typeof WalkMode)[keyof typeof WalkMode];

/** The walk class of tile (tx, ty); `Blocked` outside the map. */
export type WalkClassOf = (tx: number, ty: number) => WalkClass;

/** True for the classes a walker on the ground may stand on. */
export function isGroundLevel(c: WalkClass): boolean {
  return c === WalkClass.Ground || c === WalkClass.Stairs;
}

/**
 * Whether a walker may step from a tile of class `from` to a neighbour of class `to` in `mode`; `sideA` and `sideB`
 * are the classes of the two tiles beside a diagonal step (ignored for a straight one). A `from` of `Blocked` (a tile
 * built over under the walker) counts as ground, so walkers can walk off it.
 */
export function canStep(
  from: WalkClass,
  to: WalkClass,
  diagonal: boolean,
  sideA: WalkClass,
  sideB: WalkClass,
  mode: WalkMode,
): boolean {
  const start = from === WalkClass.Blocked ? WalkClass.Ground : from;
  if (to === WalkClass.Blocked) return false;
  if (start === WalkClass.Top) {
    if (to === WalkClass.Top) return true; // along the walk, diagonals too: wall runs join at their corners
    if (diagonal) return false;
    return to === WalkClass.Stairs || mode === WalkMode.Down;
  }
  if (to === WalkClass.Top) return !diagonal && start === WalkClass.Stairs && mode === WalkMode.Climb;
  return !diagonal || (isGroundLevel(sideA) && isGroundLevel(sideB));
}
