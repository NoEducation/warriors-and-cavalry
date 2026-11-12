// Every tree of a world: one instanced mesh per species and square region, so three.js can skip regions out of view.
import * as THREE from 'three';
import { ObjectKind } from '../sim/ObjectKind';
import type { World } from '../sim/World';
import { treeAppearance, type TreeAppearance } from './treeAppearance';
import { TreeGeometryFactory } from './TreeGeometryFactory';
import { ALL_TREE_SPECIES, type TreeSpecies } from './TreeSpecies';

/** Tiles per region side. Each region gets its own meshes and bounding spheres for frustum culling. */
export const TREE_REGION_SIZE = 64;
/** Trees are sunk into the ground so trunks do not float on slopes. */
const TREE_SINK = 0.05;

/** The trees of one species in one region, as instance matrices and tints. */
interface TreeBatch {
  readonly species: TreeSpecies;
  readonly matrices: THREE.Matrix4[];
  readonly tints: number[];
}

export class TreeLayer {
  /** Add this to the scene; contains one instanced mesh per species and region that has trees. */
  public readonly object = new THREE.Group();
  private readonly geometries = new Map<TreeSpecies, THREE.BufferGeometry>();
  // Vertex colours carry trunk and crown colours; three.js multiplies them by the per-instance tint (setColorAt).
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private readonly meshes: THREE.InstancedMesh[] = [];

  /** Builds the meshes for every tree currently in `world`. Reads the world only; call again for a new world. */
  public constructor(world: World) {
    const batches = this.collectBatches(world);
    if (batches.length === 0) return;
    const factory = new TreeGeometryFactory();
    for (const species of ALL_TREE_SPECIES) {
      if (batches.some((b) => b.species === species)) this.geometries.set(species, factory.create(species));
    }
    for (const batch of batches) this.meshes.push(this.createMesh(batch));
    this.object.add(...this.meshes);
  }

  /** Removes the meshes and frees the shared geometries, the material and the instance buffers. Call once. */
  public dispose(): void {
    this.object.clear();
    for (const mesh of this.meshes) mesh.dispose();
    for (const geometry of this.geometries.values()) geometry.dispose();
    this.material.dispose();
    this.meshes.length = 0;
    this.geometries.clear();
  }

  /** Groups the trees by region and species, in row-major region order. */
  private collectBatches(world: World): TreeBatch[] {
    const { map } = world;
    const regionsPerRow = Math.ceil(map.width / TREE_REGION_SIZE);
    const batches = new Map<number, TreeBatch>();
    for (const object of world.objects()) {
      if (object.kind !== ObjectKind.Tree) continue;
      const look = treeAppearance(map, object.tx, object.ty);
      const region =
        Math.floor(object.ty / TREE_REGION_SIZE) * regionsPerRow + Math.floor(object.tx / TREE_REGION_SIZE);
      const key = region * ALL_TREE_SPECIES.length + look.species;
      let batch = batches.get(key);
      if (!batch) {
        batch = { species: look.species, matrices: [], tints: [] };
        batches.set(key, batch);
      }
      const ground = map.tileHeight(object.tx, object.ty) - TREE_SINK;
      batch.matrices.push(this.treeMatrix(look, object.tx + 0.5, ground, object.ty + 0.5));
      batch.tints.push(look.tint);
    }
    return [...batches.entries()].sort((a, b) => a[0] - b[0]).map(([, batch]) => batch);
  }

  /** Places a tree's base at (x, y, z): scaled, turned about its own axis, then leant. */
  private treeMatrix(look: TreeAppearance, x: number, y: number, z: number): THREE.Matrix4 {
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), look.rotation);
    const lean = new THREE.Quaternion().setFromEuler(new THREE.Euler(look.leanX, 0, look.leanZ));
    const scale = new THREE.Vector3(look.widthScale, look.heightScale, look.widthScale);
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), lean.multiply(turn), scale);
  }

  private createMesh(batch: TreeBatch): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.geometries.get(batch.species)!, this.material, batch.matrices.length);
    const tint = new THREE.Color();
    batch.matrices.forEach((matrix, i) => {
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, tint.setScalar(batch.tints[i]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // Culling uses the sphere around this mesh's instances only; it must be computed after the matrices are set.
    mesh.computeBoundingSphere();
    return mesh;
  }
}
