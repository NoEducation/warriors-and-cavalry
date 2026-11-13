// The wheat on every farm: it grows from stubble to full height and from green to gold over each production cycle.
import * as THREE from 'three';
import type { MapObject } from '../sim/MapObject';
import { OBJECT_KINDS, ObjectKind } from '../sim/ObjectKind';
import type { World } from '../sim/World';
import type { WorldChange } from '../sim/WorldCommand';
import { SHAPE_COLORS } from './buildings/shapeParts';
import { WheatFarmShape } from './buildings/WheatFarmShape';
import { floorHeight } from './floorHeight';

/** Crop height right after a harvest and at the end of a cycle. */
const STUBBLE_HEIGHT = 0.05;
const FULL_HEIGHT = 0.6;
const CROP_GREEN = new THREE.Color(SHAPE_COLORS.cropGreen);
const CROP_GOLD = new THREE.Color(SHAPE_COLORS.cropGold);

/** The crop of one farm and the progress it currently shows. */
interface Crop {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshLambertMaterial;
  shownProgress: number;
}

export class FarmCrops {
  /** Add this to the scene; holds one crop mesh per wheat farm. */
  public readonly object = new THREE.Group();
  /** A field-sized box one unit tall standing on y = 0; each crop scales it to its height. */
  private readonly geometry: THREE.BoxGeometry;
  private readonly crops = new Map<number, Crop>();
  private readonly unsubscribe: () => void;

  /** Shows a crop on every wheat farm of `world` and follows farms placed and demolished until `dispose`. */
  public constructor(private readonly world: World) {
    const { width, height } = OBJECT_KINDS[ObjectKind.WheatFarm];
    const inset = WheatFarmShape.fieldInset;
    this.geometry = new THREE.BoxGeometry(width - 2 * inset, 1, height - 2 * inset);
    this.geometry.translate(width / 2 - inset, 0.5, height / 2 - inset);
    for (const object of world.objects()) this.add(object);
    this.unsubscribe = world.onChange(this.onChange);
  }

  /** Sets each crop's height and colour from its farm's cycle progress. Call once per frame; skips unchanged crops. */
  public update(): void {
    for (const [id, crop] of this.crops) {
      const state = this.world.productionState(id);
      if (!state || state.progress === crop.shownProgress) continue;
      this.show(crop, state.progress / state.cycleTicks);
      crop.shownProgress = state.progress;
    }
  }

  /** Stops following the world and frees the crops' materials and shared geometry. Call after removing `object`. */
  public dispose(): void {
    this.unsubscribe();
    for (const id of [...this.crops.keys()]) this.remove(id);
    this.geometry.dispose();
  }

  private readonly onChange = (change: WorldChange): void => {
    if (change.type === 'added') this.add(change.object);
    else this.remove(change.object.id);
  };

  /** Ignores objects that are not wheat farms. A new crop starts as stubble. */
  private add(object: MapObject): void {
    if (object.kind !== ObjectKind.WheatFarm) return;
    const material = new THREE.MeshLambertMaterial({ flatShading: true });
    const mesh = new THREE.Mesh(this.geometry, material);
    const inset = WheatFarmShape.fieldInset;
    const y = floorHeight(this.world.map, object.kind, object.tx, object.ty) + WheatFarmShape.soilTop;
    mesh.position.set(object.tx + inset, y, object.ty + inset);
    const crop: Crop = { mesh, material, shownProgress: 0 };
    this.show(crop, 0);
    this.crops.set(object.id, crop);
    this.object.add(mesh);
  }

  private remove(id: number): void {
    const crop = this.crops.get(id);
    if (!crop) return;
    this.crops.delete(id);
    this.object.remove(crop.mesh);
    crop.material.dispose(); // the geometry is shared
  }

  /** Shows `growth` (0 = just cut, 1 = ripe) as height and colour. */
  private show(crop: Crop, growth: number): void {
    crop.mesh.scale.y = STUBBLE_HEIGHT + (FULL_HEIGHT - STUBBLE_HEIGHT) * growth;
    crop.material.color.lerpColors(CROP_GREEN, CROP_GOLD, growth);
  }
}
