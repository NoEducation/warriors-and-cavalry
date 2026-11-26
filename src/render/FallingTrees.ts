// Felled trees on their way down: each tips over about its base, away from its woodcutter, sinks and is then hidden.
import * as THREE from 'three';

/** Falling tuning, in seconds of game time and tiles. Frozen; tune by editing the source. */
export const FALLING_TREE_CONFIG = Object.freeze({
  seconds: 1.5,
  /** How far it tips, in radians: flat on the ground at the end. */
  angle: Math.PI / 2,
  /** How far it sinks into the ground by the end. */
  sink: 0.6,
});

/** One falling tree: its instance, its standing matrix, the axis it tips about and when it started. */
interface Fall {
  readonly mesh: THREE.InstancedMesh;
  readonly index: number;
  readonly base: THREE.Matrix4;
  readonly root: THREE.Vector3;
  readonly axis: THREE.Vector3;
  readonly start: number;
}

const UP = new THREE.Vector3(0, 1, 0);
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

export class FallingTrees {
  private readonly falls: Fall[] = [];
  private readonly turn = new THREE.Matrix4();
  private readonly shift = new THREE.Matrix4();
  private readonly back = new THREE.Matrix4();
  private readonly matrix = new THREE.Matrix4();

  /** Number of trees still falling. */
  public get count(): number {
    return this.falls.length;
  }

  /**
   * Starts felling instance `index` of `mesh`, standing at `base`, at game time `time` (seconds): it falls away from
   * `from` (the woodcutter's position; when it stands on the tree's spot, it falls toward +x).
   */
  public start(mesh: THREE.InstancedMesh, index: number, base: THREE.Matrix4, from: THREE.Vector3, time: number): void {
    const root = new THREE.Vector3().setFromMatrixPosition(base);
    const away = new THREE.Vector3(root.x - from.x, 0, root.z - from.z);
    if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
    const axis = new THREE.Vector3().crossVectors(UP, away.normalize());
    this.falls.push({ mesh, index, base: base.clone(), root, axis, start: time });
  }

  /** Poses every falling tree for game time `time`; trees that have finished are hidden and forgotten. Per frame. */
  public update(time: number): void {
    for (let i = this.falls.length - 1; i >= 0; i--) {
      const fall = this.falls[i];
      const t = Math.min(1, Math.max(0, (time - fall.start) / FALLING_TREE_CONFIG.seconds));
      if (t >= 1) {
        fall.mesh.setMatrixAt(fall.index, HIDDEN);
        this.falls.splice(i, 1);
      } else {
        this.pose(fall, t);
      }
      fall.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Forgets every falling tree without touching its instance. */
  public clear(): void {
    this.falls.length = 0;
  }

  /** Tips the tree `t` (0..1) of the way down, faster as it goes, and sinks it at the end. */
  private pose(fall: Fall, t: number): void {
    const { root } = fall;
    const sink = FALLING_TREE_CONFIG.sink * t * t * t;
    this.turn.makeRotationAxis(fall.axis, FALLING_TREE_CONFIG.angle * t * t);
    this.shift.makeTranslation(root.x, root.y - sink, root.z);
    this.back.makeTranslation(-root.x, -root.y, -root.z);
    this.matrix.copy(this.shift).multiply(this.turn).multiply(this.back).multiply(fall.base);
    fall.mesh.setMatrixAt(fall.index, this.matrix);
  }
}
