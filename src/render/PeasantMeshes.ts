// One instanced mesh per peasant body part, filled anew each frame and grown when the peasants outgrow it.
import * as THREE from 'three';
import { PeasantGeometryFactory } from './PeasantGeometryFactory';
import { PeasantPart } from './peasantParts';

/** Parts whose white vertices take a colour per instance. */
const TINTED: readonly PeasantPart[] = [PeasantPart.Torso, PeasantPart.Hat, PeasantPart.Hood, PeasantPart.Helmet];
/** Parts every peasant has two of. */
const PAIRED: readonly PeasantPart[] = [PeasantPart.Leg, PeasantPart.Arm];
const ALL_PARTS: readonly PeasantPart[] = Object.values(PeasantPart);
const PART_NAMES = new Map<PeasantPart, string>(Object.entries(PeasantPart).map(([name, part]) => [part, name]));

export class PeasantMeshes {
  private readonly geometries = new Map<PeasantPart, THREE.BufferGeometry>();
  private readonly meshes = new Map<PeasantPart, THREE.InstancedMesh>();
  private readonly counts = new Map<PeasantPart, number>();
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

  /** Creates the part meshes, with room for `capacity` figures, inside `group`, named `<prefix>-<part>`. */
  public constructor(
    private readonly group: THREE.Group,
    private capacity: number,
    private readonly prefix = 'peasant',
  ) {
    const factory = new PeasantGeometryFactory();
    for (const part of ALL_PARTS) this.geometries.set(part, factory.create(part));
    this.createMeshes();
  }

  /** Makes room for `peasants` peasants (the room doubles until it fits). Call before `begin`; may replace meshes. */
  public ensure(peasants: number): void {
    if (peasants <= this.capacity) return;
    while (this.capacity < peasants) this.capacity *= 2;
    this.disposeMeshes();
    this.createMeshes();
  }

  /** Starts a frame: every part is empty again. */
  public begin(): void {
    for (const part of ALL_PARTS) this.counts.set(part, 0);
  }

  /** Adds one instance of `part` at `matrix`, coloured `color` (sRGB) for tinted parts. Call between begin and end. */
  public push(part: PeasantPart, matrix: THREE.Matrix4, color?: THREE.Color): void {
    const mesh = this.meshes.get(part)!;
    const index = this.counts.get(part)!;
    mesh.setMatrixAt(index, matrix);
    if (color && mesh.instanceColor) mesh.setColorAt(index, color);
    this.counts.set(part, index + 1);
  }

  /** Ends a frame: shows the instances pushed since `begin`, hiding empty parts (no draw call). */
  public end(): void {
    for (const [part, mesh] of this.meshes) {
      mesh.count = this.counts.get(part) ?? 0;
      mesh.visible = mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  /** Removes and frees every mesh, geometry and the material. Call once. */
  public dispose(): void {
    this.disposeMeshes();
    for (const geometry of this.geometries.values()) geometry.dispose();
    this.geometries.clear();
    this.material.dispose();
  }

  private createMeshes(): void {
    for (const part of ALL_PARTS) {
      const room = PAIRED.includes(part) ? 2 * this.capacity : this.capacity;
      const mesh = new THREE.InstancedMesh(this.geometries.get(part)!, this.material, room);
      mesh.name = `${this.prefix}-${PART_NAMES.get(part)!.toLowerCase()}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // Created up front, so the shader does not change while playing.
      if (TINTED.includes(part)) mesh.setColorAt(0, new THREE.Color(0xffffff));
      mesh.instanceColor?.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.visible = false;
      // Peasants move every frame, so bounds computed once would go stale; they are too cheap to cull.
      mesh.frustumCulled = false;
      this.meshes.set(part, mesh);
      this.group.add(mesh);
    }
  }

  private disposeMeshes(): void {
    for (const mesh of this.meshes.values()) {
      this.group.remove(mesh);
      mesh.dispose();
    }
    this.meshes.clear();
  }
}
