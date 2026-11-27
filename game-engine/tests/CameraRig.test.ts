import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CameraRig } from '../src/render/CameraRig';

const DEG = Math.PI / 180;
const MAP = 128;
const FOCUS = new THREE.Vector3(MAP / 2, 0, MAP / 2);

/** Camera position relative to the starting focus (the map centre). */
function offset(rig: CameraRig): THREE.Vector3 {
  return rig.camera.position.clone().sub(FOCUS);
}

/** Angle of the camera above the ground plane, seen from the focus. */
function pitchOf(rig: CameraRig): number {
  const o = offset(rig);
  return Math.atan2(o.y, Math.hypot(o.x, o.z));
}

function expectLooksAtFocus(rig: CameraRig): void {
  const forward = rig.camera.getWorldDirection(new THREE.Vector3());
  const toFocus = FOCUS.clone().sub(rig.camera.position).normalize();
  expect(forward.dot(toFocus)).toBeCloseTo(1, 6);
}

describe('CameraRig', () => {
  it('starts at a 55 degree pitch looking at the map centre', () => {
    const rig = new CameraRig(MAP, MAP);
    expect(pitchOf(rig)).toBeCloseTo(55 * DEG);
    expectLooksAtFocus(rig);
  });

  it('clamps tilting up at 80 degrees, nearly above the focus', () => {
    const rig = new CameraRig(MAP, MAP);
    const distance = offset(rig).length();
    rig.tiltBy(10);
    expect(pitchOf(rig)).toBeCloseTo(80 * DEG);
    const o = offset(rig);
    expect(Math.hypot(o.x, o.z)).toBeLessThan(0.2 * distance);
    expect(o.length()).toBeCloseTo(distance);
    expectLooksAtFocus(rig);
  });

  it('clamps tilting down at 25 degrees', () => {
    const rig = new CameraRig(MAP, MAP);
    rig.tiltBy(-10);
    expect(pitchOf(rig)).toBeCloseTo(25 * DEG);
    expectLooksAtFocus(rig);
  });

  it('tilts by small amounts within the limits', () => {
    const rig = new CameraRig(MAP, MAP);
    rig.tiltBy(5 * DEG);
    expect(pitchOf(rig)).toBeCloseTo(60 * DEG);
  });

  it('rotates a quarter turn around the focus at the same distance and height', () => {
    const rig = new CameraRig(MAP, MAP);
    const before = offset(rig);
    rig.rotateBy(Math.PI / 2);
    const after = offset(rig);
    expect(after.y).toBeCloseTo(before.y);
    expect(after.length()).toBeCloseTo(before.length());
    // Horizontal components are perpendicular and equally long.
    expect(after.x * before.x + after.z * before.z).toBeCloseTo(0);
    expect(Math.hypot(after.x, after.z)).toBeCloseTo(Math.hypot(before.x, before.z));
    expectLooksAtFocus(rig);
  });

  it('keeps the pitch after rotating and the yaw after tilting', () => {
    const rig = new CameraRig(MAP, MAP);
    rig.rotateBy(1);
    rig.tiltBy(-10);
    expect(pitchOf(rig)).toBeCloseTo(25 * DEG);
    const o = offset(rig);
    expect(Math.atan2(o.x, o.z)).toBeCloseTo(1);
    expectLooksAtFocus(rig);
  });

  it('ignores non-finite rotation', () => {
    const rig = new CameraRig(MAP, MAP);
    const before = rig.camera.position.clone();
    rig.rotateBy(NaN);
    expect(rig.camera.position.distanceTo(before)).toBeCloseTo(0);
  });

  it('raises its focus to the ground under it, easing there over several frames', () => {
    const rig = new CameraRig(MAP, MAP);
    const ground = (): number => 12;
    rig.followGround(ground, 0.05);
    const target = (): THREE.Vector3 =>
      rig.camera.position.clone().add(rig.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(60));
    const firstY = rig.camera.position.y;
    expect(firstY).toBeGreaterThan(offset(new CameraRig(MAP, MAP)).y);
    for (let i = 0; i < 100; i++) rig.followGround(ground, 0.1);
    expect(rig.camera.position.y - offset(new CameraRig(MAP, MAP)).y).toBeCloseTo(12, 2);
    expect(target().y).toBeCloseTo(12, 0);
  });

  it('never lowers its focus below sea level', () => {
    const rig = new CameraRig(MAP, MAP);
    const startY = rig.camera.position.y;
    for (let i = 0; i < 50; i++) rig.followGround(() => -5, 0.1);
    expect(rig.camera.position.y).toBeCloseTo(startY, 6);
  });
});
