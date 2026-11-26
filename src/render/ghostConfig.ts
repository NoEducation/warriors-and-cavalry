// The look of placement previews: the building ghost and the wall line ghost.

/** Tints and opacity shared by every placement preview. */
export const GHOST_CONFIG = {
  /** Tint where the building or wall piece would be placed. */
  okColor: 0x44ff66,
  /** Tint where it would not. */
  blockedColor: 0xff4444,
  opacity: 0.5,
} as const;
