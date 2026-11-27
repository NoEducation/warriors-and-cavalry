// How a peasant's body is posed this frame: joint angles for walking, carrying, working and standing idle.

const DEG = Math.PI / 180;

/** Pose tuning: lengths in tiles, angles in radians, times in seconds. Frozen; tune by editing the source. */
export const PEASANT_POSE_CONFIG = Object.freeze({
  /** Tiles walked per stride (one leg forward); a full walk cycle is two strides. */
  strideTiles: 0.5,
  legSwing: 30 * DEG,
  armSwing: 25 * DEG,
  /** Body lift at the middle of each stride. */
  bob: 0.02,
  carryLean: 15 * DEG,
  /** Both arms held back to steady the load; they swing `carrySwing` about it. */
  carryArm: -40 * DEG,
  carrySwing: 8 * DEG,
  /** One raise-and-strike of the tool. */
  workPeriod: 1,
  workRaise: 120 * DEG,
  /** Share of the work period spent raising the tool; the rest is the strike. */
  workRaiseShare: 0.7,
  /** Forward dip of the torso as the tool comes down. */
  workDip: 10 * DEG,
  idlePeriod: 4,
  idleSway: 2 * DEG,
});

/** What a peasant's body is doing. */
export type PoseActivity = 'idle' | 'walk' | 'carry' | 'work';

/** What a pose is computed from. */
export interface PoseInput {
  readonly activity: PoseActivity;
  /** Tiles walked so far (render-side), which drives the steps, so feet keep pace with the ground. */
  readonly distance: number;
  /** Seconds of game time, which drives working and idling. */
  readonly time: number;
  /** 0..1 from the peasant's id, so peasants do not move in lockstep. */
  readonly phase: number;
}

/**
 * Joint angles in radians about each joint's x axis (positive swings forward), the torso's forward `lean` and the
 * body's upward `bob` in tiles.
 */
export interface Pose {
  bob: number;
  lean: number;
  leftLeg: number;
  rightLeg: number;
  leftArm: number;
  rightArm: number;
  tool: number;
}

/** Writes the pose for `input` into `out` and returns it. Allocation-free; call per peasant per frame. */
export function peasantPose(input: PoseInput, out: Pose): Pose {
  const c = PEASANT_POSE_CONFIG;
  out.bob = 0;
  out.lean = 0;
  out.leftLeg = 0;
  out.rightLeg = 0;
  out.tool = 0;
  if (input.activity === 'walk' || input.activity === 'carry') {
    const cycle = 2 * Math.PI * (input.distance / (2 * c.strideTiles) + input.phase);
    const swing = Math.sin(cycle);
    out.leftLeg = c.legSwing * swing;
    out.rightLeg = -out.leftLeg;
    out.bob = c.bob * Math.abs(Math.cos(cycle));
    if (input.activity === 'walk') {
      out.leftArm = -c.armSwing * swing;
      out.rightArm = -out.leftArm;
    } else {
      out.lean = c.carryLean;
      out.leftArm = c.carryArm - c.carrySwing * swing;
      out.rightArm = c.carryArm + c.carrySwing * swing;
    }
  } else if (input.activity === 'work') {
    const s = fraction(input.time / c.workPeriod + input.phase);
    const raised = s < c.workRaiseShare ? s / c.workRaiseShare : (1 - s) / (1 - c.workRaiseShare);
    out.rightArm = c.workRaise * raised;
    out.leftArm = 0.8 * out.rightArm;
    out.lean = s < c.workRaiseShare ? 0 : c.workDip * (1 - raised);
  } else {
    const sway = c.idleSway * Math.sin(2 * Math.PI * (input.time / c.idlePeriod + input.phase));
    out.leftArm = sway;
    out.rightArm = -sway;
  }
  return out;
}

function fraction(x: number): number {
  return x - Math.floor(x);
}
