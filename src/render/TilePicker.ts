// Finds the map tile under a screen position by raycasting against the terrain mesh.
import * as THREE from 'three';
import type { NdcPoint } from '../input/Pointer';
import type { GameMap } from '../sim/GameMap';
import type { TileCoord } from '../sim/TileCoord';

export class TilePicker {
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndcVector = new THREE.Vector2();

  /** The tile under `ndc` as seen from `camera`, or null on no hit or an out-of-bounds tile. Call per frame as needed. */
  public pick(ndc: NdcPoint, camera: THREE.Camera, terrain: THREE.Object3D, map: GameMap): TileCoord | null {
    this.ndcVector.set(ndc.x, ndc.y);
    this.raycaster.setFromCamera(this.ndcVector, camera);
    const hit = this.raycaster.intersectObject(terrain, false)[0];
    if (!hit) return null;
    const tx = Math.floor(hit.point.x);
    const ty = Math.floor(hit.point.z);
    return map.inBounds(tx, ty) ? { tx, ty } : null;
  }
}
