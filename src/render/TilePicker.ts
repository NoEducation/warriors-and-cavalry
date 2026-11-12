// Finds the map tile under a screen position by casting the camera ray against the map's heightfield.
import * as THREE from 'three';
import type { NdcPoint } from '../input/Pointer';
import type { GameMap } from '../sim/GameMap';
import type { TileCoord } from '../sim/TileCoord';
import { raycastHeightfield } from './heightfieldRaycast';

/** Farthest pick distance in world units. */
const MAX_PICK_DISTANCE = 1000;

export class TilePicker {
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndcVector = new THREE.Vector2();

  /** The tile under `ndc` as seen from `camera`, or null when the ray misses the map. Call per frame as needed. */
  public pick(ndc: NdcPoint, camera: THREE.Camera, map: GameMap): TileCoord | null {
    this.ndcVector.set(ndc.x, ndc.y);
    this.raycaster.setFromCamera(this.ndcVector, camera);
    const { origin, direction } = this.raycaster.ray;
    const hit = raycastHeightfield(map, origin, direction, MAX_PICK_DISTANCE);
    return hit ? { tx: hit.tx, ty: hit.ty } : null;
  }
}
