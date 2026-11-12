// Pure camera maths for the RTS camera (no three.js, unit-tested in Node).

export const CAMERA_CONFIG = {
  fovDeg: 30,
  pitchDeg: 55,
  minPitchDeg: 25,
  maxPitchDeg: 80,
  dragRadPerPixel: 0.005,
  minDistance: 20,
  maxDistance: 160,
  startDistance: 60,
  panSpeedPerDistance: 0.8,
  rotateSpeedDeg: 90,
  zoomStep: 1.1,
  maxDt: 0.1,
} as const;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Frame time in seconds, limited to [0, maxDt]; NaN becomes 0. */
export function clampDt(dt: number): number {
  if (Number.isNaN(dt)) return 0;
  return clamp(dt, 0, CAMERA_CONFIG.maxDt);
}

/**
 * Ground-plane movement for pan input. `forward`/`right` are -1, 0 or 1.
 * At yaw 0 forward is -z and right is +x; diagonals move at the same speed.
 */
export function panDelta(
  forward: number,
  right: number,
  yawRad: number,
  speed: number,
  dt: number,
): { dx: number; dz: number } {
  const len = Math.hypot(forward, right);
  if (len === 0) return { dx: 0, dz: 0 };
  const s = Math.sin(yawRad);
  const c = Math.cos(yawRad);
  // forward = (-sin, -cos), right = (cos, -sin) in (x, z)
  const x = forward * -s + right * c;
  const z = forward * -c + right * -s;
  const step = (speed * dt) / len;
  return { dx: x * step, dz: z * step };
}

/** Wheel zoom: positive delta zooms out by zoomStep, negative zooms in; clamped to limits. */
export function zoomDistance(distance: number, wheelDeltaY: number): number {
  const { zoomStep, minDistance, maxDistance } = CAMERA_CONFIG;
  if (wheelDeltaY > 0) distance *= zoomStep;
  else if (wheelDeltaY < 0) distance /= zoomStep;
  return clamp(distance, minDistance, maxDistance);
}

const DEG = Math.PI / 180;

/** Camera pitch in radians limited to [minPitchDeg, maxPitchDeg]; NaN becomes the starting pitch. */
export function clampPitch(pitchRad: number): number {
  const { pitchDeg, minPitchDeg, maxPitchDeg } = CAMERA_CONFIG;
  if (Number.isNaN(pitchRad)) return pitchDeg * DEG;
  return clamp(pitchRad, minPitchDeg * DEG, maxPitchDeg * DEG);
}

/** Camera yaw and pitch change, in radians, caused by a mouse drag. */
export interface DragRotation {
  readonly yawDelta: number;
  readonly pitchDelta: number;
}

/**
 * Yaw and pitch change for a drag of (dx, dy) CSS pixels; non-finite input gives no change.
 *
 * Yaw sign: `orbitOffset` puts the camera at (sin yaw, cos yaw) around the focus, so a larger yaw moves the camera
 * from +z towards +x, which turns its heading from -z towards -x: a left (counter-clockwise from above) turn, the same
 * as holding Q. When the camera turns left, what was ahead of it slides to the right of the screen, i.e. the scene
 * turns clockwise seen from above. Dragging right should turn the scene clockwise, so yawDelta = +dx (not -dx).
 * Pitch: dragging down (positive dy) raises the camera towards top-down.
 */
export function dragRotation(dxPixels: number, dyPixels: number): DragRotation {
  if (!Number.isFinite(dxPixels) || !Number.isFinite(dyPixels)) return { yawDelta: 0, pitchDelta: 0 };
  const k = CAMERA_CONFIG.dragRadPerPixel;
  return { yawDelta: dxPixels * k, pitchDelta: dyPixels * k };
}

/** Camera position relative to the focus point; at yaw 0 it sits above the +z side. */
export function orbitOffset(
  yawRad: number,
  pitchRad: number,
  distance: number,
): { x: number; y: number; z: number } {
  const horizontal = distance * Math.cos(pitchRad);
  return {
    x: horizontal * Math.sin(yawRad),
    y: distance * Math.sin(pitchRad),
    z: horizontal * Math.cos(yawRad),
  };
}
