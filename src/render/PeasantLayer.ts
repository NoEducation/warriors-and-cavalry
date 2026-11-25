// Every peasant of a world, drawn each frame one tick behind the simulation, with a bundle on a carrier's back.
import * as THREE from 'three';
import type { PeasantView } from '../sim/Peasant';
import { ResourceKind } from '../sim/ResourceKind';
import type { World } from '../sim/World';
import { PeasantGeometryFactory } from './PeasantGeometryFactory';
import { PeasantTracks } from './PeasantTracks';
import type { WorldLayer } from './WorldLayer';

/** Peasants the meshes have room for at first; the room doubles whenever more are needed. */
export const PEASANT_CAPACITY = 256;

/** Bundle colour per carried resource. */
const BUNDLE_COLORS: Record<ResourceKind, THREE.Color> = {
  [ResourceKind.Wood]: new THREE.Color(0x6b4a2b),
  [ResourceKind.Stone]: new THREE.Color(0x9a9a94),
  [ResourceKind.Food]: new THREE.Color(0xd9b93a),
};
const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);

export class PeasantLayer implements WorldLayer {
  /** Add this to the scene; holds one instanced mesh of bodies and one of bundles. */
  public readonly object = new THREE.Group();
  private readonly bodyGeometry: THREE.BufferGeometry;
  private readonly bundleGeometry: THREE.BufferGeometry;
  private readonly bodyMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private readonly bundleMaterial = new THREE.MeshLambertMaterial({ flatShading: true });
  private bodies: THREE.InstancedMesh;
  private bundles: THREE.InstancedMesh;
  private capacity = PEASANT_CAPACITY;
  /** Each peasant's positions at the last two ticks and the way it last walked. */
  private readonly tracks = new PeasantTracks();
  private readonly position = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly matrix = new THREE.Matrix4();

  /** Draws the peasants of `world` from the first `update` on. Reads the world only; create one per world. */
  public constructor(private readonly world: World) {
    const factory = new PeasantGeometryFactory();
    this.bodyGeometry = factory.create();
    this.bundleGeometry = factory.createBundle();
    this.bodies = this.createMesh('peasants', this.bodyGeometry, this.bodyMaterial, false);
    this.bundles = this.createMesh('bundles', this.bundleGeometry, this.bundleMaterial, true);
  }

  /**
   * Places every peasant one tick behind the simulation, `tickFraction` of the way from where it stood at the
   * previous tick to where it stands at the last one (so it moves every frame), and a bundle on each carrier.
   * Call once per frame, after ticking. Allocates only when the peasants outgrow the meshes or new ones arrive.
   */
  public update(tickFraction: number): void {
    this.tracks.refresh(this.world);
    let count = 0;
    for (const _ of this.world.peasants()) count++;
    if (count > this.capacity) this.grow(count);
    let bodyCount = 0;
    let bundleCount = 0;
    for (const peasant of this.world.peasants()) {
      this.place(peasant, tickFraction);
      this.bodies.setMatrixAt(bodyCount++, this.matrix);
      if (!peasant.load) continue;
      this.bundles.setMatrixAt(bundleCount, this.matrix);
      this.bundles.setColorAt(bundleCount++, BUNDLE_COLORS[peasant.load.resource]);
    }
    this.show(this.bodies, bodyCount);
    this.show(this.bundles, bundleCount);
  }

  /** Removes both meshes and frees their instance buffers, the geometries and the materials. Call once. */
  public dispose(): void {
    this.object.clear();
    this.bodies.dispose();
    this.bundles.dispose();
    this.bodyGeometry.dispose();
    this.bundleGeometry.dispose();
    this.bodyMaterial.dispose();
    this.bundleMaterial.dispose();
    this.tracks.clear();
  }

  /** Sets `matrix` to where `peasant` is drawn this frame, turned the way it walks. */
  private place(peasant: PeasantView, tickFraction: number): void {
    const heading = this.tracks.place(this.world.map, peasant, tickFraction, this.position);
    this.turn.setFromAxisAngle(UP, heading);
    this.matrix.compose(this.position, this.turn, ONE);
  }

  private show(mesh: THREE.InstancedMesh, count: number): void {
    mesh.count = count;
    mesh.visible = count > 0; // an empty instanced mesh would still cost a draw call
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /** Replaces both meshes with ones holding at least `needed` instances (the room doubled until it fits). */
  private grow(needed: number): void {
    while (this.capacity < needed) this.capacity *= 2;
    this.object.clear();
    this.bodies.dispose();
    this.bundles.dispose();
    this.bodies = this.createMesh('peasants', this.bodyGeometry, this.bodyMaterial, false);
    this.bundles = this.createMesh('bundles', this.bundleGeometry, this.bundleMaterial, true);
  }

  /** An empty instanced mesh with room for `capacity` peasants, added to `object`; `tinted` gives it instance colours. */
  private createMesh(
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    tinted: boolean,
  ): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
    mesh.name = name;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Created up front (not on the first carrier), so the shader does not change while playing.
    if (tinted) mesh.setColorAt(0, BUNDLE_COLORS[ResourceKind.Wood]);
    mesh.instanceColor?.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.visible = false;
    // Peasants move every frame, so bounds computed once would go stale; they are too cheap to cull.
    mesh.frustumCulled = false;
    this.object.add(mesh);
    return mesh;
  }
}
