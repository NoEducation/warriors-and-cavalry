// Translucent preview of the building about to be placed, tinted by whether it fits.
import * as THREE from 'three';
import { Footprint } from '../sim/Footprint';
import type { ObjectKind } from '../sim/ObjectKind';
import type { PlacementPreview } from '../sim/PlacementPreview';
import type { World } from '../sim/World';
import type { BuildingMeshFactory } from './BuildingMeshFactory';
import { disposeObject } from './disposeObject';

const OK_COLOR = 0x44ff66;
const BLOCKED_COLOR = 0xff4444;
const OPACITY = 0.5;

export class PlacementGhost {
  /** Add this to the scene once; holds the ghost building while one is shown. */
  public readonly object = new THREE.Group();
  private model: THREE.Group | null = null;
  private modelKind: ObjectKind | null = null;
  private readonly materials: THREE.MeshLambertMaterial[] = [];
  private tintedOk: boolean | null = null;

  /** Builds ghost meshes with `factory`; starts hidden. */
  public constructor(private readonly factory: BuildingMeshFactory) {
    this.object.visible = false;
  }

  /** Shows the ghost for `preview` on `world`'s terrain, green when it fits, red otherwise. Call per frame. */
  public show(world: World, preview: PlacementPreview): void {
    if (this.modelKind !== preview.kind) this.rebuild(preview.kind);
    if (this.tintedOk !== preview.ok) {
      const color = preview.ok ? OK_COLOR : BLOCKED_COLOR;
      for (const material of this.materials) material.color.setHex(color);
      this.tintedOk = preview.ok;
    }
    this.object.position.set(preview.tx, this.floorHeight(world, preview), preview.ty);
    this.object.visible = true;
  }

  /** Hides the ghost, e.g. when no build tool is selected or no tile is hovered. */
  public hide(): void {
    this.object.visible = false;
  }

  /** Replaces the model with fresh meshes of `kind` that use the ghost's own translucent materials. */
  private rebuild(kind: ObjectKind): void {
    if (this.model) {
      this.object.remove(this.model);
      disposeObject(this.model);
    }
    const model = this.factory.create(kind);
    this.materials.length = 0;
    model.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      (node.material as THREE.Material).dispose();
      const material = new THREE.MeshLambertMaterial({
        transparent: true,
        opacity: OPACITY,
        depthWrite: false,
        flatShading: true,
      });
      node.material = material;
      // Draw after other translucent meshes (the water plane), which would otherwise be blended over the ghost.
      node.renderOrder = 1;
      this.materials.push(material);
    });
    this.object.add(model);
    this.model = model;
    this.modelKind = kind;
    this.tintedOk = null;
  }

  /** Highest corner height under the footprint, ignoring corners outside the map (0 when none is inside). */
  private floorHeight(world: World, preview: PlacementPreview): number {
    return Footprint.of(preview.kind, preview.tx, preview.ty).cornerHeightRange(world.map)?.max ?? 0;
  }
}
