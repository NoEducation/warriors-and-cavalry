// Every tree of a world, drawn as two instanced meshes (trunks and foliage).
import * as THREE from 'three';
import type { MapObject } from '../sim/MapObject';
import { ObjectKind } from '../sim/ObjectKind';
import { hash2 } from '../sim/rng';
import type { World } from '../sim/World';

/** Tree shape in world units at scale 1; total height is trunkHeight - foliageOverlap + foliageHeight. */
const TREE_SHAPE = {
  trunkRadius: 0.13,
  trunkHeight: 0.6,
  foliageRadius: 0.6,
  foliageHeight: 1.15,
  /** How far the foliage cone reaches down over the trunk. */
  foliageOverlap: 0.15,
  radialSegments: 6,
  /** Trees are sunk into the ground so trunks do not float on slopes. */
  sink: 0.05,
  /** Scale varies by up to this fraction either way. */
  scaleVariation: 0.2,
} as const;

const TRUNK_COLOR = 0x6b4a2b;
const FOLIAGE_COLOR = 0x2f6b2f;
/** Mixed into the map seed for the rotation hash so rotation and scale vary independently. */
const ROTATION_SEED_SALT = 0x5bd1e995;

export class TreeLayer {
  /** Add this to the scene; contains the trunk and foliage meshes. */
  public readonly object = new THREE.Group();
  private readonly trunks: THREE.InstancedMesh;
  private readonly foliage: THREE.InstancedMesh;

  /** Builds one instance per tree currently in `world`. Reads the world only; call again for a new world. */
  public constructor(world: World) {
    const trees: MapObject[] = [];
    for (const object of world.objects()) if (object.kind === ObjectKind.Tree) trees.push(object);

    const s = TREE_SHAPE;
    // Open-ended: the caps are never visible (underground or inside the foliage), so they would only cost triangles.
    const trunkTop = s.trunkRadius * 0.7;
    const trunkGeometry = new THREE.CylinderGeometry(trunkTop, s.trunkRadius, s.trunkHeight, s.radialSegments, 1, true);
    trunkGeometry.translate(0, s.trunkHeight / 2, 0);
    const foliageGeometry = new THREE.ConeGeometry(s.foliageRadius, s.foliageHeight, s.radialSegments, 1, true);
    foliageGeometry.translate(0, s.trunkHeight - s.foliageOverlap + s.foliageHeight / 2, 0);

    this.trunks = this.createMesh(trunkGeometry, TRUNK_COLOR, trees.length);
    this.foliage = this.createMesh(foliageGeometry, FOLIAGE_COLOR, trees.length);
    this.placeInstances(world, trees);
    this.object.add(this.trunks, this.foliage);
  }

  /** Frees the geometries, materials and instance buffers. Call after removing `object` from the scene. */
  public dispose(): void {
    for (const mesh of [this.trunks, this.foliage]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
  }

  private createMesh(geometry: THREE.BufferGeometry, color: number, count: number): THREE.InstancedMesh {
    const material = new THREE.MeshLambertMaterial({ color, flatShading: true });
    return new THREE.InstancedMesh(geometry, material, count);
  }

  private placeInstances(world: World, trees: readonly MapObject[]): void {
    const { map } = world;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    trees.forEach((tree, i) => {
      const scaleHash = hash2(map.seed, tree.tx, tree.ty);
      const rotationHash = hash2(map.seed ^ ROTATION_SEED_SALT, tree.tx, tree.ty);
      position.set(tree.tx + 0.5, map.tileHeight(tree.tx, tree.ty) - TREE_SHAPE.sink, tree.ty + 0.5);
      rotation.setFromAxisAngle(up, rotationHash * Math.PI * 2);
      scale.setScalar(1 + TREE_SHAPE.scaleVariation * (2 * scaleHash - 1));
      matrix.compose(position, rotation, scale);
      this.trunks.setMatrixAt(i, matrix);
      this.foliage.setMatrixAt(i, matrix);
    });
    for (const mesh of [this.trunks, this.foliage]) {
      mesh.instanceMatrix.needsUpdate = true;
      // Frustum culling uses the bounding sphere of all instances; it must be computed after the matrices are set.
      mesh.computeBoundingSphere();
    }
  }
}
