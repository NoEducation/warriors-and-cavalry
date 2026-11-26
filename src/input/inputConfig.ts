// Pointer and keyboard tuning, in one frozen object.

export const INPUT_CONFIG = Object.freeze({
  /** A press that moves more than this many CSS pixels away from where it started is a drag, not a click. */
  dragThresholdPx: 4,
});
