// The stumps felled trees leave: short bark-brown trunks with a pale cut top, one instanced mesh for all of them.
import * as THREE from 'three';
import type { MapObject } from '../sim/MapObject';
import { ObjectKind } from '../sim/ObjectKind';
import type { World } from '../sim/World';
import { ShapeBuilder } from './buildings/ShapeBuilder';
import { disposeObject } from './disposeObject';
import { WorldChangeQueue } from './WorldChangeQueue';
import type { WorldLayer } from './WorldLayer';

/** Stump drawing tuning, in tiles. Frozen; tune by editing the source. */
export const STUMP_CONFIG = Object.freeze({
  initialCapacity: 64,
  radius: 0.13,
  height: 0.14,
  /** Sunk into the ground, so stumps do not float on slopes. */
  sink: 0.03,
  bark: 0x4a3420,
  cut: 0xa8885a,
  sides: 7,
});

export class StumpLayer implements WorldLayer {
  /** Add this to the scene; holds the one instanced mesh, named `stumps`. */
  public readonly object = new THREE.Group();
  private readonly changes: WorldChangeQueue;
  private readonly template: THREE.Mesh;
  private mesh: THREE.InstancedMesh;
  /** The stumps drawn, in instance order. */
  private readonly stumps: MapObject[] = [];
  private readonly matrix = new THREE.Matrix4();

  /** Shows the stumps already in `world` and follows its stumps from then on, at each `update`, until `dispose`. */
  public constructor(world: World) {
    const c = STUMP_CONFIG;
    const trunk = new THREE.CylinderGeometry(c.radius * 0.9, c.radius, c.height, c.sides).translate(0, c.height / 2, 0);
    const top = new THREE.CylinderGeometry(c.radius * 0.8, c.radius * 0.8, 0.01, c.sides).translate(0, c.height, 0);
    this.template = new ShapeBuilder().add(trunk, c.bark).add(top, c.cut).build();
    this.mesh = this.createMesh(c.initialCapacity);
    for (const object of world.objects()) if (object.kind === ObjectKind.Stump) this.stumps.push(object);
    this.changes = new WorldChangeQueue(world);
    this.refill(world);
  }

  /** Adds and removes stumps placed in or cleared from `world` since the last call. Call once per frame. */
  public update(world: World): void {
    let changed = false;
    this.changes.drain((change) => {
      if (change.object.kind !== ObjectKind.Stump) return;
      changed = true;
      if (change.type === 'added') this.stumps.push(change.object);
      else if (change.type === 'removed') this.stumps.splice(this.stumps.indexOf(change.object), 1);
    });
    if (changed) this.refill(world);
  }

  /** Stops following the world and frees the mesh, its geometry and material. Call once. */
  public dispose(): void {
    this.changes.dispose();
    this.object.clear();
    this.mesh.dispose();
    disposeObject(this.template);
    this.stumps.length = 0;
  }

  /** Writes every stump's matrix, growing the mesh (doubling its room) when the stumps outgrow it. */
  private refill(world: World): void {
    let room = this.mesh.instanceMatrix.count;
    if (this.stumps.length > room) {
      while (room < this.stumps.length) room *= 2;
      this.object.clear();
      this.mesh.dispose();
      this.mesh = this.createMesh(room);
    }
    this.stumps.forEach((stump, i) => {
      const y = world.map.tileHeight(stump.tx, stump.ty) - STUMP_CONFIG.sink;
      this.mesh.setMatrixAt(i, this.matrix.makeTranslation(stump.tx + 0.5, y, stump.ty + 0.5));
    });
    this.mesh.count = this.stumps.length;
    this.mesh.visible = this.stumps.length > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private createMesh(capacity: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.template.geometry, this.template.material, capacity);
    mesh.name = 'stumps';
    mesh.count = 0;
    mesh.visible = false;
    // Stumps come and go anywhere on the map; a bounding sphere computed once would go stale.
    mesh.frustumCulled = false;
    this.object.add(mesh);
    return mesh;
  }
}
