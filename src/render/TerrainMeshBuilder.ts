// Flat-shaded terrain built from a GameMap's corner heights and tile types, split into square chunks; colours come
// from terrainColor per corner, with a per-triangle speckle.
import * as THREE from 'three';
import type { GameMap } from '../sim/GameMap';
import { hash2 } from '../sim/rng';
import { TileType } from '../sim/tiles';
import { terrainVertexColor } from './terrainColor';
import { terrainTileShade } from './terrainTileShade';

/** Tiles per chunk side. Chunks let three.js skip the parts of the map outside the view. */
export const TERRAIN_CHUNK_SIZE = 32;

/** Brightness swing of the per-triangle speckle that gives the flat-shaded ground its pixel texture. */
const SPECKLE = 0.07;

const VERTS_PER_TILE = 6;

/** A rectangle of tiles: first tile (x0, y0) and size in tiles. */
interface TileRect {
  readonly x0: number;
  readonly y0: number;
  readonly width: number;
  readonly height: number;
}

export class TerrainMeshBuilder {
  /**
   * Builds one mesh per TERRAIN_CHUNK_SIZE x TERRAIN_CHUNK_SIZE block of tiles (edge chunks may be smaller), all sharing
   * one material, with vertices in world coordinates. Call once per map; the caller owns the group and disposes it.
   * Does not mutate the map.
   */
  public build(map: GameMap): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    for (let y0 = 0; y0 < map.height; y0 += TERRAIN_CHUNK_SIZE) {
      for (let x0 = 0; x0 < map.width; x0 += TERRAIN_CHUNK_SIZE) {
        const rect: TileRect = {
          x0,
          y0,
          width: Math.min(TERRAIN_CHUNK_SIZE, map.width - x0),
          height: Math.min(TERRAIN_CHUNK_SIZE, map.height - y0),
        };
        group.add(new THREE.Mesh(this.buildChunkGeometry(map, rect), material));
      }
    }
    return group;
  }

  /** One quad (two triangles, counter-clockwise seen from +y) per tile of `rect`. */
  private buildChunkGeometry(map: GameMap, rect: TileRect): THREE.BufferGeometry {
    const tileCount = rect.width * rect.height;
    const positions = new Float32Array(tileCount * VERTS_PER_TILE * 3);
    const colors = new Float32Array(tileCount * VERTS_PER_TILE * 3);
    const corner = [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()];
    let i = 0;

    for (let ty = rect.y0; ty < rect.y0 + rect.height; ty++) {
      for (let tx = rect.x0; tx < rect.x0 + rect.width; tx++) {
        const type = map.tileAt(tx, ty) ?? TileType.Water;
        const cx = [tx, tx + 1, tx, tx + 1];
        const cy = [ty, ty, ty + 1, ty + 1];
        const shade = terrainTileShade(map, type, tx, ty);
        for (let k = 0; k < 4; k++) terrainVertexColor(map, type, cx[k], cy[k], corner[k]).multiplyScalar(shade);
        // Corners a, b, c, d; split along the b-c diagonal, which heightfieldRaycast tests too.
        for (const [n, k] of [0, 2, 1, 1, 2, 3].entries()) {
          const speckle = 1 + SPECKLE * 2 * (hash2(map.seed, tx * 2 + (n < 3 ? 0 : 1), ty) - 0.5);
          positions[i * 3] = cx[k];
          positions[i * 3 + 1] = map.heightAt(cx[k], cy[k]);
          positions[i * 3 + 2] = cy[k];
          colors[i * 3] = corner[k].r * speckle;
          colors[i * 3 + 1] = corner[k].g * speckle;
          colors[i * 3 + 2] = corner[k].b * speckle;
          i++;
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }
}
