// Translucent sea surface covering the whole map.
import * as THREE from 'three';
import type { GameMap } from '../sim/GameMap';

export class WaterMeshBuilder {
  /**
   * Builds a single horizontal plane over x in [0, width], z in [0, height] at y = seaLevel.
   * Call once per map; the caller owns the result and disposes it.
   */
  public build(map: GameMap, seaLevel: number): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(map.width, map.height);
    geometry.rotateX(-Math.PI / 2); // plane normal +z -> +y
    geometry.translate(map.width / 2, seaLevel, map.height / 2);
    const material = new THREE.MeshLambertMaterial({ color: 0x2f6fa8, transparent: true, opacity: 0.75 });
    return new THREE.Mesh(geometry, material);
  }
}
