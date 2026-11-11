// Pure camera maths for the RTS camera (no three.js, unit-tested in Node).

export const CAMERA_CONFIG = {
  fovDeg: 30,
  pitchDeg: 55,
  minDistance: 20,
  maxDistance: 120,
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
