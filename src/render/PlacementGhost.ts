// Translucent preview of the building about to be placed, tinted by whether it fits.
import * as THREE from 'three';
import type { ObjectKind } from '../sim/ObjectKind';
import type { PlacementPreview } from '../sim/PlacementPreview';
import type { World } from '../sim/World';
import type { BuildingMeshFactory } from './BuildingMeshFactory';
import { floorHeight } from './floorHeight';

const OK_COLOR = 0x44ff66;
const BLOCKED_COLOR = 0xff4444;
const OPACITY = 0.5;

export class PlacementGhost {
  /** Add this to the scene once; holds the ghost building while one is shown. */
  public readonly object = new THREE.Group();
  /**
   * The ghost's own translucent material, shared by every model it shows; placed buildings keep theirs. It ignores the
   * building's vertex colours, so the whole ghost shows the tint.
   */
  private readonly material = new THREE.MeshLambertMaterial({
    transparent: true,
    opacity: OPACITY,
    depthWrite: false,
    flatShading: true,
  });
  private model: THREE.Mesh | null = null;
  private modelKind: ObjectKind | null = null;
  private tintedOk: boolean | null = null;

  /** Builds ghost meshes with `factory`; starts hidden. */
  public constructor(private readonly factory: BuildingMeshFactory) {
    this.object.visible = false;
  }

  /** Shows the ghost for `preview` on `world`'s terrain, green when it fits, red otherwise. Call per frame. */
  public show(world: World, preview: PlacementPreview): void {
    if (this.modelKind !== preview.kind) this.rebuild(preview.kind);
    if (this.tintedOk !== preview.ok) {
      this.material.color.setHex(preview.ok ? OK_COLOR : BLOCKED_COLOR);
      this.tintedOk = preview.ok;
    }
    this.object.position.set(preview.tx, floorHeight(world.map, preview.kind, preview.tx, preview.ty), preview.ty);
    this.object.visible = true;
  }

  /** Hides the ghost, e.g. when no build tool is selected or no tile is hovered. */
  public hide(): void {
    this.object.visible = false;
  }

  /** Replaces the model with a fresh mesh of `kind` drawn with the ghost's material. */
  private rebuild(kind: ObjectKind): void {
    if (this.model) {
      this.object.remove(this.model);
      this.model.geometry.dispose(); // the material is the ghost's own and stays
    }
    const model = this.factory.create(kind);
    (model.material as THREE.Material).dispose();
    model.material = this.material;
    // Draw after other translucent meshes (the water plane), which would otherwise be blended over the ghost.
    model.renderOrder = 1;
    this.object.add(model);
    this.model = model;
    this.modelKind = kind;
  }
}
