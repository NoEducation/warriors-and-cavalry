// Meshes for every building in a world, kept in step with the world's changes.
import * as THREE from 'three';
import type { MapObject } from '../sim/MapObject';
import { OBJECT_KINDS, ObjectKind } from '../sim/ObjectKind';
import type { World } from '../sim/World';
import type { BuildingMeshFactory } from './BuildingMeshFactory';
import { disposeObject } from './disposeObject';
import { floorHeight } from './floorHeight';
import { gatePassage } from './gatePassage';
import { WorldChangeQueue } from './WorldChangeQueue';
import type { WorldLayer } from './WorldLayer';

export class BuildingLayer implements WorldLayer {
  /** Add this to the scene; holds one child per building. */
  public readonly object = new THREE.Group();
  private readonly meshes = new Map<number, THREE.Object3D>();
  private readonly changes: WorldChangeQueue;

  /**
   * Shows the buildings already in `world` and follows its additions and removals, at each `update`, until `dispose`.
   * Never changes the world.
   */
  public constructor(world: World, private readonly factory: BuildingMeshFactory) {
    for (const object of world.objects()) this.add(world, object);
    this.changes = new WorldChangeQueue(world);
  }

  /** Number of buildings currently shown. */
  public get buildingCount(): number {
    return this.meshes.size;
  }

  /** Adds and removes meshes for the buildings placed in or demolished from `world` since the last call. Per frame. */
  public update(world: World): void {
    this.changes.drain((change) => {
      if (change.type === 'added') this.add(world, change.object);
      else this.remove(change.object);
    });
  }

  /** Stops following the world and frees every building mesh. Call after removing `object` from the scene. */
  public dispose(): void {
    this.changes.dispose();
    for (const mesh of this.meshes.values()) {
      this.object.remove(mesh);
      disposeObject(mesh);
    }
    this.meshes.clear();
  }

  /** Ignores objects that are not buildings (trees). */
  private add(world: World, object: MapObject): void {
    const info = OBJECT_KINDS[object.kind];
    if (!info.buildable) return;
    // A gate's passage is decided once, when its mesh is made.
    const passage = object.kind === ObjectKind.Gate ? gatePassage(world, object.tx, object.ty) : undefined;
    const mesh = this.factory.create(object.kind, passage);
    mesh.position.set(object.tx, floorHeight(world.map, object.kind, object.tx, object.ty), object.ty);
    this.meshes.set(object.id, mesh);
    this.object.add(mesh);
  }

  private remove(object: MapObject): void {
    const mesh = this.meshes.get(object.id);
    if (!mesh) return;
    this.meshes.delete(object.id);
    this.object.remove(mesh);
    disposeObject(mesh);
  }
}
