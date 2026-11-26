// Log bundles and stone blocks on every stockpile, showing how full the camp's wood and stone storage is.
import * as THREE from 'three';
import type { MapObject } from '../sim/MapObject';
import { ObjectKind } from '../sim/ObjectKind';
import { ResourceKind } from '../sim/ResourceKind';
import type { World } from '../sim/World';
import { StockpileShape } from './buildings/StockpileShape';
import { SHAPE_COLORS } from './buildings/shapeParts';
import { floorHeight } from './floorHeight';
import { WorldChangeQueue } from './WorldChangeQueue';
import type { WorldLayer } from './WorldLayer';

/** Stack slots per resource on one stockpile: 2 columns x 2 rows x 2 layers. */
const SLOTS = 8;
const COLUMN_STEP = 0.5;
const ROW_STEP = 1.1;
const LOG_RADIUS = 0.19;
const LOG_LENGTH = 1.0;
/** Log bundles (0.38 across) nest slightly into the layer below; stone blocks sit flat on each other. */
const LOG_LAYER_STEP = 0.36;
const STONE_SIZE = new THREE.Vector3(0.44, 0.32, 0.8);

/** How one resource is stacked: its mesh name, shape, first slot's centre and the height of one layer. */
interface StackStyle {
  readonly name: string;
  readonly resource: ResourceKind;
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
  /** Centre of the first slot, from the stockpile's corner on its deck. */
  readonly origin: THREE.Vector3;
  readonly layerStep: number;
}

export class StockpileStacks implements WorldLayer {
  /** Add this to the scene; holds one instanced mesh for all logs and one for all stones while a stockpile stands. */
  public readonly object = new THREE.Group();
  private readonly styles: readonly StackStyle[];
  /** Corner (x, floor + deck, z) of each stockpile, by object id. */
  private readonly stockpiles = new Map<number, THREE.Vector3>();
  /** One mesh per style (same order), with room for every slot of every stockpile; empty without stockpiles. */
  private readonly meshes: THREE.InstancedMesh[] = [];
  private readonly changes: WorldChangeQueue;
  private readonly matrix = new THREE.Matrix4();
  private stockpilesChanged = true;

  /** Follows the stockpiles of `world` until `dispose`; draws nothing before the first `update`. Reads only. */
  public constructor(world: World) {
    this.styles = [
      {
        name: 'logs',
        resource: ResourceKind.Wood,
        geometry: new THREE.CylinderGeometry(LOG_RADIUS, LOG_RADIUS, LOG_LENGTH, 6).rotateX(Math.PI / 2),
        material: new THREE.MeshLambertMaterial({ color: SHAPE_COLORS.logs, flatShading: true }),
        origin: new THREE.Vector3(0.62, 0.18, 0.95),
        layerStep: LOG_LAYER_STEP,
      },
      {
        name: 'stones',
        resource: ResourceKind.Stone,
        geometry: new THREE.BoxGeometry(STONE_SIZE.x, STONE_SIZE.y, STONE_SIZE.z),
        material: new THREE.MeshLambertMaterial({ color: SHAPE_COLORS.stone, flatShading: true }),
        origin: new THREE.Vector3(1.88, STONE_SIZE.y / 2, 0.95),
        layerStep: STONE_SIZE.y,
      },
    ];
    for (const object of world.objects()) this.add(world, object);
    this.changes = new WorldChangeQueue(world);
  }

  /**
   * Brings the stacks in line with `world`'s stockpiles and stored wood and stone. Call once per frame. Allocates meshes
   * only when stockpiles were placed or demolished; otherwise only the instance counts change.
   */
  public update(world: World): void {
    this.changes.drain((change) => {
      if (change.type === 'added') this.add(world, change.object);
      else if (change.type === 'removed') this.remove(change.object);
    });
    if (this.stockpilesChanged) this.allocateMeshes();
    this.styles.forEach((style, i) => {
      const mesh = this.meshes[i];
      if (!mesh) return;
      const count = this.stackCount(world, style.resource) * this.stockpiles.size;
      if (count === mesh.count) return;
      mesh.count = count;
      mesh.visible = count > 0; // an empty instanced mesh would still cost a draw call
    });
  }

  /** Stops following the world and frees every mesh, geometry and material. Call after removing `object`. */
  public dispose(): void {
    this.changes.dispose();
    this.clearMeshes();
    for (const style of this.styles) {
      style.geometry.dispose();
      style.material.dispose();
    }
  }

  /** Ignores objects that are not stockpiles. The stacks follow later in the same `update`. */
  private add(world: World, object: MapObject): void {
    if (object.kind !== ObjectKind.Stockpile) return;
    const y = floorHeight(world.map, object.kind, object.tx, object.ty) + StockpileShape.deckTop;
    this.stockpiles.set(object.id, new THREE.Vector3(object.tx, y, object.ty));
    this.stockpilesChanged = true;
  }

  private remove(object: MapObject): void {
    if (!this.stockpiles.delete(object.id)) return;
    this.stockpilesChanged = true;
  }

  /** `ceil(SLOTS × amount / capacity)`: how many stacks of `kind` each stockpile shows. */
  private stackCount(world: World, kind: ResourceKind): number {
    const capacity = world.economy.capacity(kind);
    return capacity > 0 ? Math.min(SLOTS, Math.ceil((SLOTS * world.economy.amount(kind)) / capacity)) : 0;
  }

  /**
   * Replaces the meshes with ones holding every slot of every stockpile, slot by slot (slot 0 of each stockpile, then
   * slot 1, …), so a count of `n × stockpiles` shows the first `n` slots on each, bottom layer first. Starts empty.
   */
  private allocateMeshes(): void {
    this.clearMeshes();
    this.stockpilesChanged = false;
    if (this.stockpiles.size === 0) return;
    for (const style of this.styles) {
      const mesh = new THREE.InstancedMesh(style.geometry, style.material, SLOTS * this.stockpiles.size);
      mesh.name = style.name;
      let index = 0;
      for (let slot = 0; slot < SLOTS; slot++) {
        for (const corner of this.stockpiles.values()) {
          const x = corner.x + style.origin.x + (slot % 2) * COLUMN_STEP;
          const y = corner.y + style.origin.y + Math.floor(slot / 4) * style.layerStep;
          const z = corner.z + style.origin.z + (Math.floor(slot / 2) % 2) * ROW_STEP;
          mesh.setMatrixAt(index++, this.matrix.makeTranslation(x, y, z));
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      // Bounds cover every slot (computed while count is still full), so culling stays right as stacks come and go.
      mesh.computeBoundingSphere();
      mesh.computeBoundingBox();
      mesh.count = 0;
      mesh.visible = false;
      this.meshes.push(mesh);
      this.object.add(mesh);
    }
  }

  /** Removes the instanced meshes and frees their instance buffers; the shared geometries and materials stay. */
  private clearMeshes(): void {
    for (const mesh of this.meshes) {
      this.object.remove(mesh);
      mesh.dispose();
    }
    this.meshes.length = 0;
  }
}
