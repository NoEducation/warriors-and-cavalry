// A small health bar over every damaged unit and building: a dark back with a coloured fill for what is left.
import * as THREE from 'three';
import { OBJECT_KINDS } from '../sim/ObjectKind';
import { Side, UNIT_KINDS } from '../sim/UnitKind';
import type { World } from '../sim/World';
import { floorHeight } from './floorHeight';
import type { UnitLayer } from './UnitLayer';
import type { WorldLayer } from './WorldLayer';

/** Health bar sizes (tiles) and colours (sRGB); frozen, tune by editing the source. */
export const HEALTH_BAR_CONFIG = Object.freeze({
  capacity: 256,
  thickness: 0.07,
  unitWidth: 0.5,
  /** Height of a unit's bar above its feet. */
  unitHeight: 1.05,
  /** A building's bar is this share of its footprint's width, at `buildingHeight` per footprint tile above its floor. */
  buildingShare: 0.8,
  buildingHeight: 0.7,
  back: 0x1c1a18,
  friend: 0x6cc04a,
  foe: 0xd8442f,
});

export class HealthBars implements WorldLayer {
  /** Add this to the scene; the back and fill meshes (`health-back`, `health-fill`). */
  public readonly object = new THREE.Group();
  private readonly geometry = new THREE.BoxGeometry(1, HEALTH_BAR_CONFIG.thickness, HEALTH_BAR_CONFIG.thickness);
  private readonly backMaterial = new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.back });
  private readonly fillMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private readonly back: THREE.InstancedMesh;
  private readonly fill: THREE.InstancedMesh;
  private readonly feet = new THREE.Vector3();
  private readonly matrix = new THREE.Matrix4();
  private readonly color = new THREE.Color();
  private count = 0;

  /** Bars over the units `units` draws, and over buildings. */
  public constructor(private readonly units: UnitLayer) {
    this.back = this.createMesh('health-back', this.backMaterial);
    this.fill = this.createMesh('health-fill', this.fillMaterial);
    this.fill.setColorAt(0, this.color.set(0xffffff));
  }

  /** Shows a bar over every damaged unit and building of `world`. Call once per frame, after the unit layer. */
  public update(world: World, tickFraction: number): void {
    this.count = 0;
    for (const unit of world.units()) {
      const max = UNIT_KINDS[unit.kind].hitPoints;
      if (unit.hitPoints >= max || unit.hitPoints <= 0) continue;
      this.units.placeOf(world, unit, tickFraction, this.feet);
      this.feet.y += HEALTH_BAR_CONFIG.unitHeight;
      this.add(this.feet, HEALTH_BAR_CONFIG.unitWidth, unit.hitPoints / max, unit.side === Side.Player);
    }
    for (const object of world.objects()) {
      const hp = world.buildingHitPoints(object.id);
      if (!hp || hp.current >= hp.max) continue;
      const { width, height } = OBJECT_KINDS[object.kind];
      const lift = HEALTH_BAR_CONFIG.buildingHeight * Math.max(width, height);
      this.feet.set(object.tx + width / 2, floorHeight(world.map, object.kind, object.tx, object.ty) + lift, object.ty + height / 2);
      this.add(this.feet, width * HEALTH_BAR_CONFIG.buildingShare, hp.current / hp.max, true);
    }
    for (const mesh of [this.back, this.fill]) {
      mesh.count = this.count;
      mesh.visible = this.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.fill.instanceColor) this.fill.instanceColor.needsUpdate = true;
  }

  /** Frees the geometry and materials. Call once. */
  public dispose(): void {
    this.geometry.dispose();
    this.backMaterial.dispose();
    this.fillMaterial.dispose();
    this.back.dispose();
    this.fill.dispose();
    this.object.clear();
  }

  /** One bar centred on `at`, `width` long, filled to `share` from its left end. */
  private add(at: THREE.Vector3, width: number, share: number, friend: boolean): void {
    if (this.count >= HEALTH_BAR_CONFIG.capacity) return;
    this.back.setMatrixAt(this.count, this.matrix.makeScale(width, 1, 1).setPosition(at));
    const filled = width * share;
    this.matrix.makeScale(filled, 1.3, 1.3).setPosition(at.x - (width - filled) / 2, at.y, at.z);
    this.fill.setMatrixAt(this.count, this.matrix);
    this.fill.setColorAt(this.count, this.color.set(friend ? HEALTH_BAR_CONFIG.friend : HEALTH_BAR_CONFIG.foe));
    this.count++;
  }

  private createMesh(name: string, material: THREE.Material): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.geometry, material, HEALTH_BAR_CONFIG.capacity);
    mesh.name = name;
    mesh.count = 0;
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.object.add(mesh);
    return mesh;
  }
}
