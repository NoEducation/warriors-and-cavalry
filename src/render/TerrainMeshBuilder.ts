// Flat-shaded terrain mesh built from a GameMap's corner heights and tile types.
import * as THREE from 'three';
import type { GameMap } from '../sim/GameMap';
import { hash2 } from '../sim/rng';
import { TileType } from '../sim/tiles';

const TILE_COLORS: Record<TileType, number> = {
  [TileType.Water]: 0x8a7f5c, // seabed
  [TileType.Sand]: 0xd9c98a,
  [TileType.Grass]: 0x5d9c3f,
  [TileType.Rock]: 0x8c8c88,
};

const VERTS_PER_TILE = 6;

export class TerrainMeshBuilder {
  /**
   * Builds one quad (two triangles, counter-clockwise seen from +y) per tile. Call once per map;
   * the caller owns the result and disposes it. Does not mutate the map.
   */
  public build(map: GameMap): THREE.Mesh {
    const tileCount = map.width * map.height;
    const positions = new Float32Array(tileCount * VERTS_PER_TILE * 3);
    const colors = new Float32Array(tileCount * VERTS_PER_TILE * 3);
    const color = new THREE.Color();
    let i = 0;

    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const type = map.tileAt(tx, ty) ?? TileType.Water;
        color.set(TILE_COLORS[type]).multiplyScalar(0.94 + 0.12 * hash2(map.seed, tx, ty));

        const a = [tx, map.heightAt(tx, ty), ty];
        const b = [tx + 1, map.heightAt(tx + 1, ty), ty];
        const c = [tx, map.heightAt(tx, ty + 1), ty + 1];
        const d = [tx + 1, map.heightAt(tx + 1, ty + 1), ty + 1];
        for (const v of [a, c, b, b, c, d]) {
          positions.set(v, i * 3);
          colors[i * 3] = color.r;
          colors[i * 3 + 1] = color.g;
          colors[i * 3 + 2] = color.b;
          i++;
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    return new THREE.Mesh(geometry, material);
  }
}
