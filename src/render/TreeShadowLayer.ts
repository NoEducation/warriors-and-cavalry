// Soft dark discs on the ground under every tree, offset away from the sun, so trees sit on the terrain instead of
// floating. One instanced mesh per TREE_REGION_SIZE region, so three.js can skip regions out of view.
import * as THREE from 'three';
import type { GameMap } from '../sim/GameMap';
import { ObjectKind } from '../sim/ObjectKind';
import type { World } from '../sim/World';
import { treeAppearance } from './treeAppearance';
import { TREE_REGION_SIZE } from './TreeLayer';
import { TREE_SPECIES } from './TreeSpecies';
import type { WorldLayer } from './WorldLayer';

/** Shadow tuning in world units. Tune by editing these values. */
export const TREE_SHADOW_CONFIG = Object.freeze({
  /** Disc radius as a multiple of the tree's crown radius. */
  radiusScale: 1.25,
  /** Ground offset per unit of tree height, pointing away from the sun (which shines from -x, -z). */
  offsetX: 0.18,
  offsetZ: 0.08,
  /** Height of the disc above the ground, against z-fighting. */
  lift: 0.03,
  opacity: 0.3,
  color: 0x0b1606,
  segments: 9,
});

const UP = new THREE.Vector3(0, 1, 0);

export class TreeShadowLayer implements WorldLayer {
  /** Add this to the scene; holds one instanced shadow mesh per region that has trees. */
  public readonly object = new THREE.Group();
  private readonly geometry = new THREE.CircleGeometry(1, TREE_SHADOW_CONFIG.segments).rotateX(-Math.PI / 2);
  private readonly material = new THREE.MeshBasicMaterial({
    color: TREE_SHADOW_CONFIG.color,
    transparent: true,
    opacity: TREE_SHADOW_CONFIG.opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  private readonly meshes: THREE.InstancedMesh[] = [];

  /** Builds a shadow for every tree currently in `world`. Reads the world only; call again for a new world. */
  public constructor(world: World) {
    const { map } = world;
    const regionsPerRow = Math.ceil(map.width / TREE_REGION_SIZE);
    const regions = new Map<number, THREE.Matrix4[]>();
    for (const object of world.objects()) {
      if (object.kind !== ObjectKind.Tree) continue;
      const look = treeAppearance(map, object.tx, object.ty);
      const species = TREE_SPECIES[look.species];
      const region =
        Math.floor(object.ty / TREE_REGION_SIZE) * regionsPerRow + Math.floor(object.tx / TREE_REGION_SIZE);
      let matrices = regions.get(region);
      if (!matrices) {
        matrices = [];
        regions.set(region, matrices);
      }
      const height = species.height * look.heightScale;
      matrices.push(this.matrixFor(map, object.tx, object.ty, height, species.crownRadius * look.widthScale));
    }
    for (const [, matrices] of [...regions.entries()].sort((a, b) => a[0] - b[0])) {
      this.meshes.push(this.createMesh(matrices));
    }
    if (this.meshes.length > 0) this.object.add(...this.meshes);
  }

  /** Nothing changes per frame: the shadows are built once per world. Part of WorldLayer. */
  public update(): void {}

  /** Removes the meshes and frees the disc geometry, the material and the instance buffers. Call once. */
  public dispose(): void {
    this.object.clear();
    for (const mesh of this.meshes) mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.meshes.length = 0;
  }

  /** A disc lying on the slope of tile (tx, ty), shifted away from the sun by the tree's `height`. */
  private matrixFor(map: GameMap, tx: number, ty: number, height: number, radius: number): THREE.Matrix4 {
    const c = TREE_SHADOW_CONFIG;
    const h00 = map.heightAt(tx, ty);
    const h10 = map.heightAt(tx + 1, ty);
    const h01 = map.heightAt(tx, ty + 1);
    const h11 = map.heightAt(tx + 1, ty + 1);
    const slopeX = (h10 - h00 + (h11 - h01)) / 2;
    const slopeZ = (h01 - h00 + (h11 - h10)) / 2;
    const normal = new THREE.Vector3(-slopeX, 1, -slopeZ).normalize();
    const dx = c.offsetX * height;
    const dz = c.offsetZ * height;
    const ground = map.tileHeight(tx, ty) + slopeX * dx + slopeZ * dz;
    const position = new THREE.Vector3(tx + 0.5 + dx, ground, ty + 0.5 + dz).addScaledVector(normal, c.lift);
    const tilt = new THREE.Quaternion().setFromUnitVectors(UP, normal);
    const size = radius * c.radiusScale;
    return new THREE.Matrix4().compose(position, tilt, new THREE.Vector3(size, 1, size));
  }

  private createMesh(matrices: readonly THREE.Matrix4[]): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, matrices.length);
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    // Culling uses the sphere around this mesh's instances only; it must be computed after the matrices are set.
    mesh.computeBoundingSphere();
    return mesh;
  }
}
