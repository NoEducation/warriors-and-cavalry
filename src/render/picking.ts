// Finds the map tile under a screen position by raycasting against the terrain mesh.
import * as THREE from 'three';
import type { GameMap } from '../sim/map';

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

/** ndcX/ndcY are normalised device coordinates (-1..1, +y up). Null on no hit or an out-of-bounds tile. */
export function pickTile(
  ndcX: number,
  ndcY: number,
  camera: THREE.Camera,
  terrain: THREE.Mesh,
  map: GameMap,
): { tx: number; ty: number } | null {
  ndc.set(ndcX, ndcY);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(terrain, false)[0];
  if (!hit) return null;
  const tx = Math.floor(hit.point.x);
  const ty = Math.floor(hit.point.z);
  return map.inBounds(tx, ty) ? { tx, ty } : null;
}
