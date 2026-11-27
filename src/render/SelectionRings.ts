// A flat ring at the feet of every selected soldier.
import * as THREE from 'three';
import type { World } from '../sim/World';
import type { UnitLayer } from './UnitLayer';

/** Ring look; frozen, tune by editing the source. */
export const SELECTION_RING_CONFIG = Object.freeze({
  capacity: 128,
  inner: 0.22,
  outer: 0.3,
  /** Height above the feet, so the ring does not flicker into the ground. */
  lift: 0.03,
  color: 0xf4e27a,
});

export class SelectionRings {
  /** Add this to the scene once; it stays across maps. */
  public readonly object: THREE.InstancedMesh;
  private readonly geometry = new THREE.RingGeometry(SELECTION_RING_CONFIG.inner, SELECTION_RING_CONFIG.outer, 20).rotateX(-Math.PI / 2);
  private readonly material = new THREE.MeshBasicMaterial({ color: SELECTION_RING_CONFIG.color, side: THREE.DoubleSide });
  private readonly feet = new THREE.Vector3();
  private readonly matrix = new THREE.Matrix4();

  /** Creates the empty ring mesh. */
  public constructor() {
    this.object = new THREE.InstancedMesh(this.geometry, this.material, SELECTION_RING_CONFIG.capacity);
    this.object.name = 'selection-rings';
    this.object.count = 0;
    this.object.frustumCulled = false;
    this.object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  /**
   * Rings the units `ids` of `world` where `units` draws them this frame; none without a unit layer. Call once per
   * frame, after the world view update.
   */
  public update(world: World, ids: readonly number[], units: UnitLayer | null, tickFraction: number): void {
    let count = 0;
    for (const id of ids) {
      const unit = world.unitById(id);
      if (!unit || !units || count >= SELECTION_RING_CONFIG.capacity) continue;
      units.placeOf(world, unit, tickFraction, this.feet);
      this.feet.y += SELECTION_RING_CONFIG.lift;
      this.object.setMatrixAt(count++, this.matrix.makeTranslation(this.feet.x, this.feet.y, this.feet.z));
    }
    this.object.count = count;
    this.object.visible = count > 0;
    this.object.instanceMatrix.needsUpdate = true;
  }

  /** Frees the mesh, geometry and material. Call once. */
  public dispose(): void {
    this.object.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
