// The parts a peasant (or soldier) is drawn from, where their joints sit on the figure, and the boxes each part is built of.

/** Each part is one instanced mesh for all peasants; the number is only an id. */
export const PeasantPart = {
  Leg: 0,
  Arm: 1,
  Torso: 2,
  Head: 3,
  Hat: 4,
  Hood: 5,
  LogBundle: 6,
  StoneBundle: 7,
  SackBundle: 8,
  Axe: 9,
  Pick: 10,
  Hoe: 11,
  Spear: 12,
  Bow: 13,
  Helmet: 14,
} as const;
export type PeasantPart = (typeof PeasantPart)[keyof typeof PeasantPart];

/**
 * Joint positions in figure space (feet at y = 0, facing +z, x to the figure's left): hip and shoulder heights and
 * their sideways offsets, the waist and neck heights, and the hand's height below the shoulder along the arm.
 */
export const PEASANT_JOINTS = Object.freeze({
  hip: 0.3,
  hipSide: 0.06,
  waist: 0.3,
  shoulder: 0.58,
  shoulderSide: 0.19,
  neck: 0.6,
  hand: -0.27,
});

/** One box of a part, centred on (cx, cz), from y0 to y1; `taper` scales its top face (1 for a plain box). */
export interface PartPiece {
  readonly cx: number;
  readonly cz: number;
  readonly w: number;
  readonly d: number;
  readonly y0: number;
  readonly y1: number;
  readonly color: number;
  readonly taper: number;
}

/** White parts take their colour from the instance (tunic, headwear). */
const WHITE = 0xffffff;
const SKIN = 0xe0b48c;
const COLORS = Object.freeze({
  hose: 0x5a4632,
  shoe: 0x2e2218,
  sleeve: 0xcbb994,
  belt: 0x4a3420,
  eyes: 0x2a1c14,
  hair: 0x5b3a1e,
  log: 0x6b4a2b,
  logEnd: 0xc9a46a,
  stone: 0x9a9a94,
  strap: 0x6e5236,
  sack: 0xc8ad78,
  handle: 0x7a5530,
  iron: 0x6d7378,
  blade: 0xa7acb0,
  bowWood: 0x5a3a1e,
  string: 0xd8d0b8,
});

function piece(cx: number, cz: number, w: number, d: number, y0: number, y1: number, color: number, taper = 1): PartPiece {
  return { cx, cz, w, d, y0, y1, color, taper };
}

const HAND = PEASANT_JOINTS.hand;

/** The boxes of each part, in that part's own space: its joint at the origin, facing +z. */
export const PEASANT_PART_PIECES: Readonly<Record<PeasantPart, readonly PartPiece[]>> = Object.freeze({
  [PeasantPart.Leg]: [piece(0, 0, 0.09, 0.1, -0.25, 0, COLORS.hose), piece(0, 0.025, 0.1, 0.15, -0.3, -0.25, COLORS.shoe)],
  [PeasantPart.Arm]: [piece(0, 0, 0.08, 0.08, -0.22, 0, COLORS.sleeve, 0.9), piece(0, 0, 0.07, 0.07, -0.28, -0.22, SKIN)],
  [PeasantPart.Torso]: [
    piece(0, 0, 0.32, 0.2, -0.08, 0.04, WHITE), // the tunic's skirt over the hips
    piece(0, 0, 0.3, 0.18, 0.04, 0.3, WHITE, 0.8),
    piece(0, 0, 0.31, 0.19, 0.04, 0.08, COLORS.belt),
  ],
  [PeasantPart.Head]: [
    piece(0, 0, 0.15, 0.15, 0.02, 0.17, SKIN),
    piece(0, 0.076, 0.1, 0.004, 0.09, 0.11, COLORS.eyes),
    piece(0, -0.06, 0.16, 0.05, 0.06, 0.17, COLORS.hair),
    piece(0, 0, 0.16, 0.16, 0.15, 0.18, COLORS.hair),
  ],
  [PeasantPart.Hat]: [piece(0, 0, 0.27, 0.27, 0.16, 0.18, WHITE), piece(0, 0, 0.15, 0.15, 0.18, 0.25, WHITE, 0.65)],
  [PeasantPart.Hood]: [piece(0, -0.015, 0.18, 0.18, 0.03, 0.2, WHITE, 0.75), piece(0, -0.01, 0.26, 0.2, -0.02, 0.04, WHITE)],
  [PeasantPart.LogBundle]: [
    piece(0, -0.13, 0.36, 0.07, 0.26, 0.33, COLORS.log),
    piece(0, -0.13, 0.38, 0.06, 0.33, 0.39, COLORS.logEnd),
    piece(0, -0.13, 0.34, 0.07, 0.39, 0.46, COLORS.log),
  ],
  [PeasantPart.StoneBundle]: [piece(0, -0.18, 0.2, 0.16, 0.12, 0.3, COLORS.stone), piece(0, -0.1, 0.22, 0.02, 0.14, 0.3, COLORS.strap)],
  [PeasantPart.SackBundle]: [piece(0, -0.17, 0.22, 0.15, 0.1, 0.36, COLORS.sack, 0.7), piece(0, -0.17, 0.08, 0.06, 0.36, 0.4, COLORS.strap)],
  [PeasantPart.Axe]: [
    piece(0, 0.15, 0.03, 0.42, HAND - 0.015, HAND + 0.015, COLORS.handle),
    piece(0, 0.33, 0.025, 0.08, HAND - 0.02, HAND + 0.09, COLORS.blade),
  ],
  [PeasantPart.Pick]: [
    piece(0, 0.15, 0.03, 0.42, HAND - 0.015, HAND + 0.015, COLORS.handle),
    piece(0, 0.35, 0.03, 0.04, HAND - 0.1, HAND + 0.1, COLORS.iron),
  ],
  [PeasantPart.Hoe]: [
    piece(0, 0.15, 0.03, 0.46, HAND - 0.015, HAND + 0.015, COLORS.handle),
    piece(0, 0.37, 0.12, 0.03, HAND - 0.07, HAND, COLORS.iron),
  ],
  [PeasantPart.Spear]: [
    piece(0, 0.2, 0.025, 0.9, HAND - 0.012, HAND + 0.012, COLORS.handle),
    piece(0, 0.69, 0.035, 0.1, HAND - 0.02, HAND + 0.02, COLORS.blade),
  ],
  [PeasantPart.Bow]: [
    piece(0, 0.05, 0.03, 0.03, HAND - 0.26, HAND + 0.26, COLORS.bowWood),
    piece(0, 0.1, 0.03, 0.04, HAND + 0.2, HAND + 0.26, COLORS.bowWood),
    piece(0, 0.1, 0.03, 0.04, HAND - 0.26, HAND - 0.2, COLORS.bowWood),
    piece(0, 0.12, 0.006, 0.006, HAND - 0.24, HAND + 0.24, COLORS.string),
  ],
  [PeasantPart.Helmet]: [piece(0, 0, 0.18, 0.18, 0.11, 0.21, WHITE, 0.75), piece(0, 0.085, 0.03, 0.01, 0.05, 0.14, WHITE)],
});
