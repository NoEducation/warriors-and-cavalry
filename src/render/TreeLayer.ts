// Every tree of a world: one instanced mesh per species and square region, so three.js can skip regions out of view.
// A chopped tree is drawn smaller per round taken; a felled tree tips over and is hidden; trees are never added after the world is generated.
import * as THREE from 'three';
import { TICKS_PER_SECOND } from '../sim/gameTime';
import { ObjectKind } from '../sim/ObjectKind';
import type { World } from '../sim/World';
import { FallingTrees } from './FallingTrees';
import type { TreeSlot } from './TreeShadowLayer';
import { treeAppearance, type TreeAppearance } from './treeAppearance';
import { TreeGeometryFactory } from './TreeGeometryFactory';
import { TreeStages } from './TreeStages';
import { ALL_TREE_SPECIES, type TreeSpecies } from './TreeSpecies';
import { WorldChangeQueue } from './WorldChangeQueue';
import type { WorldLayer } from './WorldLayer';

/** Tree drawing tuning. */
export const TREE_LAYER_CONFIG = Object.freeze({
  /** Tiles per region side. Each region gets its own meshes and bounding spheres for frustum culling. */
  regionSize: 64,
  /** Trees are sunk into the ground so trunks do not float on slopes. */
  sink: 0.05,
});

/** The trees of one species in one region, as instance matrices and tints. */
interface TreeBatch {
  readonly species: TreeSpecies;
  readonly ids: number[];
  readonly matrices: THREE.Matrix4[];
  readonly tints: number[];
}

export class TreeLayer implements WorldLayer {
  /** Add this to the scene; contains one instanced mesh per species and region that has trees. */
  public readonly object = new THREE.Group();
  private readonly geometries = new Map<TreeSpecies, THREE.BufferGeometry>();
  // Vertex colours carry trunk and crown colours; three.js multiplies them by the per-instance tint (setColorAt).
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private readonly meshes: THREE.InstancedMesh[] = [];
  /** Where each tree is drawn, by tree id. */
  private readonly slots = new Map<number, TreeSlot>();
  private readonly stages = new TreeStages(false);
  private readonly falling = new FallingTrees();
  private readonly changes: WorldChangeQueue;
  private readonly chopper = new THREE.Vector3();

  /**
   * Builds the meshes for every tree currently in `world` and follows its felled trees from then on. Reads the world
   * only; call again for a new world.
   */
  public constructor(world: World) {
    this.changes = new WorldChangeQueue(world);
    const batches = this.collectBatches(world);
    if (batches.length === 0) return;
    const factory = new TreeGeometryFactory();
    for (const species of ALL_TREE_SPECIES) {
      if (batches.some((b) => b.species === species)) this.geometries.set(species, factory.create(species));
    }
    for (const batch of batches) this.meshes.push(this.createMesh(batch));
    this.object.add(...this.meshes);
  }

  /**
   * Shrinks each tree chopped in `world` since the last call, starts the fall of each one removed (away from the
   * nearest peasant, its woodcutter) and poses the falling ones for the current game time. Call once per frame.
   */
  public update(world: World, tickFraction: number): void {
    const time = (world.tickCount + tickFraction) / TICKS_PER_SECOND;
    this.changes.drain((change) => {
      const slot = change.type === 'added' ? undefined : this.slots.get(change.object.id);
      if (!slot) return;
      if (change.type === 'chopped') {
        this.stages.chopped(world, change.object.id, slot);
        return;
      }
      this.stages.forget(change.object.id);
      this.slots.delete(change.object.id);
      const base = new THREE.Matrix4();
      slot.mesh.getMatrixAt(slot.index, base);
      this.falling.start(slot.mesh, slot.index, base, this.nearestPeasant(world, change.object.tx, change.object.ty), time);
    });
    this.falling.update(time);
  }

  /** Stops following the world, removes the meshes and frees the geometries, the material and the buffers. Once. */
  public dispose(): void {
    this.changes.dispose();
    this.falling.clear();
    this.slots.clear();
    this.stages.clear();
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
    const regionsPerRow = Math.ceil(map.width / TREE_LAYER_CONFIG.regionSize);
    const batches = new Map<number, TreeBatch>();
    for (const object of world.objects()) {
      if (object.kind !== ObjectKind.Tree) continue;
      const look = treeAppearance(map, object.tx, object.ty);
      const region =
        Math.floor(object.ty / TREE_LAYER_CONFIG.regionSize) * regionsPerRow + Math.floor(object.tx / TREE_LAYER_CONFIG.regionSize);
      const key = region * ALL_TREE_SPECIES.length + look.species;
      let batch = batches.get(key);
      if (!batch) {
        batch = { species: look.species, ids: [], matrices: [], tints: [] };
        batches.set(key, batch);
      }
      const ground = map.tileHeight(object.tx, object.ty) - TREE_LAYER_CONFIG.sink;
      batch.ids.push(object.id);
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
      this.slots.set(batch.ids[i], { mesh, index: i });
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, tint.setScalar(batch.tints[i]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // Culling uses the sphere around this mesh's instances only; it must be computed after the matrices are set.
    mesh.computeBoundingSphere();
    return mesh;
  }

  /** Where the peasant nearest tile (tx, ty) stands (its woodcutter); the tile centre when there is none. */
  private nearestPeasant(world: World, tx: number, ty: number): THREE.Vector3 {
    let best = Infinity;
    this.chopper.set(tx + 0.5, 0, ty + 0.5);
    for (const p of world.peasants()) {
      const d = (p.tx - tx) ** 2 + (p.ty - ty) ** 2;
      if (d < best) {
        best = d;
        this.chopper.set(p.tx + 0.5, 0, p.ty + 0.5);
      }
    }
    return this.chopper;
  }
}
