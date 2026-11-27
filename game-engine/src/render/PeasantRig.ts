// Turns a peasant's body placement and pose into one matrix per body part, joint by joint.
import * as THREE from 'three';
import type { Pose } from './peasantPose';
import { PEASANT_JOINTS } from './peasantParts';

/** Where each part of one peasant is drawn this frame, in world space. Left is the figure's left (+x). */
export interface PeasantPartMatrices {
  readonly leftLeg: THREE.Matrix4;
  readonly rightLeg: THREE.Matrix4;
  readonly leftArm: THREE.Matrix4;
  readonly rightArm: THREE.Matrix4;
  readonly torso: THREE.Matrix4;
  /** The head; the headwear shares it. */
  readonly head: THREE.Matrix4;
  /** The load bundle, in torso space. */
  readonly bundle: THREE.Matrix4;
  /** The tool, in right-arm space. */
  readonly tool: THREE.Matrix4;
}

export class PeasantRig {
  private readonly joint = new THREE.Matrix4();
  private readonly swing = new THREE.Matrix4();

  /** A fresh set of part matrices to pass to `pose`, reused frame after frame. */
  public createMatrices(): PeasantPartMatrices {
    const m = (): THREE.Matrix4 => new THREE.Matrix4();
    return { leftLeg: m(), rightLeg: m(), leftArm: m(), rightArm: m(), torso: m(), head: m(), bundle: m(), tool: m() };
  }

  /**
   * Sets `out` for a peasant whose feet stand at `body` (position and heading) in `pose`: legs swing at the hips,
   * the torso leans at the waist, arms swing at the shoulders of the leaning torso, the head sits on its neck and the
   * tool follows the right hand. Allocation-free; call per peasant per frame.
   */
  public pose(body: THREE.Matrix4, pose: Pose, out: PeasantPartMatrices): void {
    const j = PEASANT_JOINTS;
    this.limb(out.leftLeg, body, j.hipSide, j.hip, pose.leftLeg);
    this.limb(out.rightLeg, body, -j.hipSide, j.hip, pose.rightLeg);
    out.torso.copy(body).multiply(this.joint.makeTranslation(0, j.waist, 0)).multiply(this.swing.makeRotationX(pose.lean));
    this.limb(out.leftArm, out.torso, j.shoulderSide, j.shoulder - j.waist, pose.leftArm);
    this.limb(out.rightArm, out.torso, -j.shoulderSide, j.shoulder - j.waist, pose.rightArm);
    out.head.copy(out.torso).multiply(this.joint.makeTranslation(0, j.neck - j.waist, 0));
    out.bundle.copy(out.torso);
    out.tool.copy(out.rightArm).multiply(this.swing.makeRotationX(-pose.tool));
  }

  /** `out` = `parent`, moved to the joint at (x, y, 0) and swung forward by `angle` (toward +z). */
  private limb(out: THREE.Matrix4, parent: THREE.Matrix4, x: number, y: number, angle: number): void {
    out.copy(parent).multiply(this.joint.makeTranslation(x, y, 0)).multiply(this.swing.makeRotationX(-angle));
  }
}
