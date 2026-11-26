// The wheat on every farm: it grows from stubble to full height and from green to gold over each production cycle.
import * as THREE from 'three';
import type { MapObject } from '../sim/MapObject';
import { OBJECT_KINDS, ObjectKind } from '../sim/ObjectKind';
import type { World } from '../sim/World';
import { SHAPE_COLORS } from './buildings/shapeParts';
import { WheatFarmShape } from './buildings/WheatFarmShape';
import { floorHeight } from './floorHeight';
import { WorldChangeQueue } from './WorldChangeQueue';
import type { WorldLayer } from './WorldLayer';

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

export class FarmCrops implements WorldLayer {
  /** Add this to the scene; holds one crop mesh per wheat farm. */
  public readonly object = new THREE.Group();
  /** A field-sized box one unit tall standing on y = 0; each crop scales it to its height. */
  private readonly geometry: THREE.BoxGeometry;
  private readonly crops = new Map<number, Crop>();
  /** Length of a wheat farm's production cycle; a crop is ripe at the end of it. */
  private readonly cycleTicks = OBJECT_KINDS[ObjectKind.WheatFarm].production?.cycleTicks ?? 1;
  private readonly changes: WorldChangeQueue;

  /** Shows a crop on every wheat farm of `world` and follows the farms placed and demolished until `dispose`. */
  public constructor(world: World) {
    const { width, height } = OBJECT_KINDS[ObjectKind.WheatFarm];
    const inset = WheatFarmShape.fieldInset;
    this.geometry = new THREE.BoxGeometry(width - 2 * inset, 1, height - 2 * inset);
    this.geometry.translate(width / 2 - inset, 0.5, height / 2 - inset);
    for (const object of world.objects()) this.add(world, object);
    this.changes = new WorldChangeQueue(world);
  }

  /**
   * Adds and removes crops for the farms placed in or demolished from `world` since the last call, then sets each
   * crop's height and colour from its farm's cycle progress. Call once per frame; skips unchanged crops.
   */
  public update(world: World): void {
    this.changes.drain((change) => {
      if (change.type === 'added') this.add(world, change.object);
      else this.remove(change.object.id);
    });
    for (const [id, crop] of this.crops) {
      const progress = world.productionProgress(id);
      if (progress === null || progress === crop.shownProgress) continue;
      this.show(crop, progress / this.cycleTicks);
      crop.shownProgress = progress;
    }
  }

  /** Stops following the world and frees the crops' materials and shared geometry. Call after removing `object`. */
  public dispose(): void {
    this.changes.dispose();
    for (const id of [...this.crops.keys()]) this.remove(id);
    this.geometry.dispose();
  }

  /** Ignores objects that are not wheat farms. A new crop starts as stubble. */
  private add(world: World, object: MapObject): void {
    if (object.kind !== ObjectKind.WheatFarm) return;
    const material = new THREE.MeshLambertMaterial({ flatShading: true });
    const mesh = new THREE.Mesh(this.geometry, material);
    const inset = WheatFarmShape.fieldInset;
    const y = floorHeight(world.map, object.kind, object.tx, object.ty) + WheatFarmShape.soilTop;
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
