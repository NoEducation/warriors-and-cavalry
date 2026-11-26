// Meshes for every building in a world, kept in step with the world's changes.
import * as THREE from 'three';
import type { MapObject } from '../sim/MapObject';
import { OBJECT_KINDS, ObjectKind } from '../sim/ObjectKind';
import type { World } from '../sim/World';
import type { WorldChange } from '../sim/WorldCommand';
import type { BuildingMeshFactory, GatePassage } from './BuildingMeshFactory';
import { disposeObject } from './disposeObject';
import { floorHeight } from './floorHeight';
import type { WorldLayer } from './WorldLayer';

/** Kinds that make up a castle wall line; a gate next to one of them is turned to pass through the line. */
const WALL_LINE_KINDS: readonly ObjectKind[] = [ObjectKind.Wall, ObjectKind.Gate, ObjectKind.Tower];

export class BuildingLayer implements WorldLayer {
  /** Add this to the scene; holds one child per building. */
  public readonly object = new THREE.Group();
  private readonly meshes = new Map<number, THREE.Object3D>();
  private readonly unsubscribe: () => void;

  /** Shows the buildings already in `world` and follows additions and removals until `dispose`. Never changes the world. */
  public constructor(
    private readonly world: World,
    private readonly factory: BuildingMeshFactory,
  ) {
    for (const object of world.objects()) this.add(object);
    this.unsubscribe = world.onChange(this.onChange);
  }

  /** Number of buildings currently shown. */
  public get buildingCount(): number {
    return this.meshes.size;
  }

  /** Nothing changes per frame: the buildings follow the world's changes as they happen. Part of WorldLayer. */
  public update(): void {}

  /** Stops following the world and frees every building mesh. Call after removing `object` from the scene. */
  public dispose(): void {
    this.unsubscribe();
    for (const mesh of this.meshes.values()) {
      this.object.remove(mesh);
      disposeObject(mesh);
    }
    this.meshes.clear();
  }

  private readonly onChange = (change: WorldChange): void => {
    if (change.type === 'added') this.add(change.object);
    else this.remove(change.object);
  };

  /** Ignores objects that are not buildings (trees). */
  private add(object: MapObject): void {
    const info = OBJECT_KINDS[object.kind];
    if (!info.buildable) return;
    const passage = object.kind === ObjectKind.Gate ? this.gatePassage(object) : undefined;
    const mesh = this.factory.create(object.kind, passage);
    mesh.position.set(object.tx, floorHeight(this.world.map, object.kind, object.tx, object.ty), object.ty);
    this.meshes.set(object.id, mesh);
    this.object.add(mesh);
  }

  /**
   * The passage of a newly shown gate: north–south when a wall piece stands west or east of it (the wall runs east–west),
   * otherwise east–west. Decided once, when the mesh is made.
   */
  private gatePassage(gate: MapObject): GatePassage {
    const besideWall = [gate.tx - 1, gate.tx + 1].some((tx) => {
      const neighbour = this.world.objectAt(tx, gate.ty);
      return neighbour !== undefined && WALL_LINE_KINDS.includes(neighbour.kind);
    });
    return besideWall ? 'northSouth' : 'eastWest';
  }

  private remove(object: MapObject): void {
    const mesh = this.meshes.get(object.id);
    if (!mesh) return;
    this.meshes.delete(object.id);
    this.object.remove(mesh);
    disposeObject(mesh);
  }
}
