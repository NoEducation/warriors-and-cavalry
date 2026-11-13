// Log bundles and stone blocks on every stockpile, showing how full the camp's wood and stone storage is.
import * as THREE from 'three';
import { ObjectKind } from '../sim/ObjectKind';
import { ResourceKind } from '../sim/ResourceKind';
import type { World } from '../sim/World';
import type { WorldChange } from '../sim/WorldCommand';
import { StockpileShape } from './buildings/StockpileShape';
import { SHAPE_COLORS } from './buildings/shapeParts';
import { floorHeight } from './floorHeight';

/** Stack slots per resource on one stockpile: 2 columns x 2 rows x 2 layers. */
const SLOTS = 8;
const COLUMN_STEP = 0.5;
const ROW_STEP = 1.1;
const LAYER_STEP = 0.36;
/** Centre of the first slot of the log half (low x) and of the stone half, from the stockpile's corner. */
const LOG_ORIGIN = new THREE.Vector3(0.62, 0.18, 0.95);
const STONE_ORIGIN = new THREE.Vector3(1.88, 0.16, 0.95);
const LOG_RADIUS = 0.19;
const LOG_LENGTH = 1.0;

export class StockpileStacks {
  /** Add this to the scene; holds one instanced mesh for all logs and one for all stones while any are shown. */
  public readonly object = new THREE.Group();
  private readonly logGeometry = new THREE.CylinderGeometry(LOG_RADIUS, LOG_RADIUS, LOG_LENGTH, 6).rotateX(Math.PI / 2);
  private readonly stoneGeometry = new THREE.BoxGeometry(0.44, 0.32, 0.8);
  private readonly logMaterial = new THREE.MeshLambertMaterial({ color: SHAPE_COLORS.logs, flatShading: true });
  private readonly stoneMaterial = new THREE.MeshLambertMaterial({ color: SHAPE_COLORS.stone, flatShading: true });
  /** Corner (x, floor + deck, z) of each stockpile, by object id. */
  private readonly stockpiles = new Map<number, THREE.Vector3>();
  private readonly meshes: THREE.InstancedMesh[] = [];
  private readonly unsubscribe: () => void;
  private readonly matrix = new THREE.Matrix4();
  private shownLogs = -1;
  private shownStones = -1;
  private stockpilesChanged = true;

  /** Follows the stockpiles of `world` until `dispose`; draws nothing before the first `update`. Reads only. */
  public constructor(private readonly world: World) {
    for (const object of world.objects()) this.onChange({ type: 'added', object });
    this.unsubscribe = world.onChange(this.onChange);
  }

  /** Brings the stacks in line with the stored wood and stone. Call once per frame; rebuilds only on a change. */
  public update(): void {
    const logs = this.stackCount(ResourceKind.Wood);
    const stones = this.stackCount(ResourceKind.Stone);
    if (!this.stockpilesChanged && logs === this.shownLogs && stones === this.shownStones) return;
    this.clearMeshes();
    this.addMesh('logs', this.logGeometry, this.logMaterial, LOG_ORIGIN, logs);
    this.addMesh('stones', this.stoneGeometry, this.stoneMaterial, STONE_ORIGIN, stones);
    this.shownLogs = logs;
    this.shownStones = stones;
    this.stockpilesChanged = false;
  }

  /** Stops following the world and frees every mesh, geometry and material. Call after removing `object`. */
  public dispose(): void {
    this.unsubscribe();
    this.clearMeshes();
    this.logGeometry.dispose();
    this.stoneGeometry.dispose();
    this.logMaterial.dispose();
    this.stoneMaterial.dispose();
  }

  private readonly onChange = (change: WorldChange): void => {
    const { object } = change;
    if (object.kind !== ObjectKind.Stockpile) return;
    if (change.type === 'added') {
      const y = floorHeight(this.world.map, object.kind, object.tx, object.ty) + StockpileShape.deckTop;
      this.stockpiles.set(object.id, new THREE.Vector3(object.tx, y, object.ty));
    } else {
      this.stockpiles.delete(object.id);
    }
    this.stockpilesChanged = true;
  };

  /** `ceil(SLOTS × amount / capacity)`: how many stacks of `kind` each stockpile shows. */
  private stackCount(kind: ResourceKind): number {
    const capacity = this.world.economy.capacity(kind);
    return capacity > 0 ? Math.min(SLOTS, Math.ceil((SLOTS * this.world.economy.amount(kind)) / capacity)) : 0;
  }

  /** Adds one instanced mesh with `perStockpile` stacks on every stockpile, filling the bottom layer first. */
  private addMesh(
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    origin: THREE.Vector3,
    perStockpile: number,
  ): void {
    const count = perStockpile * this.stockpiles.size;
    if (count === 0) return;
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = name;
    let index = 0;
    for (const corner of this.stockpiles.values()) {
      for (let slot = 0; slot < perStockpile; slot++) {
        const x = corner.x + origin.x + (slot % 2) * COLUMN_STEP;
        const y = corner.y + origin.y + Math.floor(slot / 4) * LAYER_STEP;
        const z = corner.z + origin.z + (Math.floor(slot / 2) % 2) * ROW_STEP;
        mesh.setMatrixAt(index++, this.matrix.makeTranslation(x, y, z));
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere(); // after the matrices, so culling covers every stack
    this.meshes.push(mesh);
    this.object.add(mesh);
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
