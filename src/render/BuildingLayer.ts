// Meshes for every building in a world, kept in step with the world's changes.
import * as THREE from 'three';
import type { MapObject } from '../sim/MapObject';
import { OBJECT_KINDS, ObjectKind } from '../sim/ObjectKind';
import type { World } from '../sim/World';
import type { WorldChange } from '../sim/WorldCommand';
import type { BuildingMeshFactory } from './BuildingMeshFactory';
import { disposeObject } from './disposeObject';
import { floorHeight } from './floorHeight';
import { gatePassage } from './gatePassage';
import type { WorldLayer } from './WorldLayer';

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
    // A gate's passage is decided once, when its mesh is made.
    const passage = object.kind === ObjectKind.Gate ? gatePassage(this.world, object.tx, object.ty) : undefined;
    const mesh = this.factory.create(object.kind, passage);
    mesh.position.set(object.tx, floorHeight(this.world.map, object.kind, object.tx, object.ty), object.ty);
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
