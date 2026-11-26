import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PEASANT_JOINTS } from '../src/render/peasantParts';
import type { Pose } from '../src/render/peasantPose';
import { PeasantRig } from '../src/render/PeasantRig';

const still = (): Pose => ({ bob: 0, lean: 0, leftLeg: 0, rightLeg: 0, leftArm: 0, rightArm: 0, tool: 0 });
const origin = (m: THREE.Matrix4): THREE.Vector3 => new THREE.Vector3().setFromMatrixPosition(m);

describe('PeasantRig', () => {
  it('puts the joints where PEASANT_JOINTS says when standing still', () => {
    const rig = new PeasantRig();
    const out = rig.createMatrices();
    rig.pose(new THREE.Matrix4(), still(), out);
    const j = PEASANT_JOINTS;
    expect(origin(out.leftLeg).toArray()).toEqual([j.hipSide, j.hip, 0]);
    expect(origin(out.rightLeg).toArray()).toEqual([-j.hipSide, j.hip, 0]);
    expect(origin(out.rightArm).toArray().map((v) => +v.toFixed(6))).toEqual([-j.shoulderSide, j.shoulder, 0]);
    expect(origin(out.head).y).toBeCloseTo(j.neck);
    expect(origin(out.torso).y).toBeCloseTo(j.waist);
  });

  it('swings a leg forward (+z) for a positive angle and leans the torso forward', () => {
    const rig = new PeasantRig();
    const out = rig.createMatrices();
    rig.pose(new THREE.Matrix4(), { ...still(), leftLeg: 0.5, lean: 0.3 }, out);
    const foot = new THREE.Vector3(0, -0.3, 0).applyMatrix4(out.leftLeg);
    expect(foot.z).toBeGreaterThan(0.1);
    const neck = origin(out.head);
    expect(neck.z).toBeGreaterThan(0.05);
  });

  it('carries the tool with the right hand when the arm is raised', () => {
    const rig = new PeasantRig();
    const out = rig.createMatrices();
    rig.pose(new THREE.Matrix4(), { ...still(), rightArm: (120 * Math.PI) / 180 }, out);
    const hand = new THREE.Vector3(0, PEASANT_JOINTS.hand, 0);
    expect(hand.clone().applyMatrix4(out.tool).y).toBeGreaterThan(PEASANT_JOINTS.shoulder);
    expect(hand.clone().applyMatrix4(out.tool).distanceTo(hand.clone().applyMatrix4(out.rightArm))).toBeCloseTo(0);
  });

  it('follows the body: position and heading', () => {
    const rig = new PeasantRig();
    const out = rig.createMatrices();
    const body = new THREE.Matrix4().compose(
      new THREE.Vector3(5, 1, 7),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2),
      new THREE.Vector3(1, 1, 1),
    );
    rig.pose(body, still(), out);
    const torso = origin(out.torso);
    expect(torso.x).toBeCloseTo(5);
    expect(torso.y).toBeCloseTo(1 + PEASANT_JOINTS.waist);
    expect(torso.z).toBeCloseTo(7);
    // Facing +x after a quarter turn, the figure's left (+x before) is now -z.
    expect(origin(out.leftLeg).z).toBeCloseTo(7 - PEASANT_JOINTS.hipSide);
  });
});
