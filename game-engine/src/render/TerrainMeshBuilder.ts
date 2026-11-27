// Flat-shaded terrain built from a GameMap's corner heights and tile types, split into square chunks; colours come
// from terrainColor per corner, with a per-triangle speckle.
import * as THREE from 'three';
import type { GameMap } from '../sim/GameMap';
import { hash2 } from '../sim/rng';
import { TileType } from '../sim/tiles';
import { terrainCornerColor } from './terrainCornerColor';
import { terrainTileShade } from './terrainTileShade';

/** Terrain mesh tuning. */
export const TERRAIN_MESH_CONFIG = Object.freeze({
  /** Tiles per chunk side. Chunks let three.js skip the parts of the map outside the view. */
  chunkSize: 32,
  /** Brightness swing of the per-triangle speckle that gives the flat-shaded ground its pixel texture. */
  speckle: 0.07,
});

const VERTS_PER_TILE = 6;

/** A rectangle of tiles: first tile (x0, y0) and size in tiles. */
interface TileRect {
  readonly x0: number;
  readonly y0: number;
  readonly width: number;
  readonly height: number;
}

/** Vertex data of one terrain chunk: plain typed arrays, so it can be built in a worker and transferred. */
export interface TerrainChunkData {
  readonly positions: Float32Array;
  readonly colors: Float32Array;
  readonly normals: Float32Array;
}

export class TerrainMeshBuilder {
  /**
   * Builds one mesh per TERRAIN_MESH_CONFIG.chunkSize x TERRAIN_MESH_CONFIG.chunkSize block of tiles (edge chunks may be smaller), all sharing
   * one material, with vertices in world coordinates. Call once per map; the caller owns the group and disposes it.
   * Does not mutate the map.
   */
  public build(map: GameMap): THREE.Group {
    return this.fromData(this.buildData(map));
  }

  /**
   * Computes the vertex data of every chunk of `map`, row by row, without making GPU objects; the slow part of
   * `build`, safe to run in a worker. Does not mutate the map.
   */
  public buildData(map: GameMap): TerrainChunkData[] {
    const chunks: TerrainChunkData[] = [];
    for (let y0 = 0; y0 < map.height; y0 += TERRAIN_MESH_CONFIG.chunkSize) {
      for (let x0 = 0; x0 < map.width; x0 += TERRAIN_MESH_CONFIG.chunkSize) {
        const rect: TileRect = {
          x0,
          y0,
          width: Math.min(TERRAIN_MESH_CONFIG.chunkSize, map.width - x0),
          height: Math.min(TERRAIN_MESH_CONFIG.chunkSize, map.height - y0),
        };
        chunks.push(this.buildChunkData(map, rect));
      }
    }
    return chunks;
  }

  /** Wraps chunk data from `buildData` in one mesh per chunk, sharing one material. The caller owns and disposes the group. */
  public fromData(chunks: readonly TerrainChunkData[]): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    for (const chunk of chunks) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(chunk.positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(chunk.colors, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(chunk.normals, 3));
      geometry.computeBoundingSphere();
      group.add(new THREE.Mesh(geometry, material));
    }
    return group;
  }

  /** One quad (two triangles, counter-clockwise seen from +y) per tile of `rect`. */
  private buildChunkData(map: GameMap, rect: TileRect): TerrainChunkData {
    const tileCount = rect.width * rect.height;
    const positions = new Float32Array(tileCount * VERTS_PER_TILE * 3);
    const colors = new Float32Array(tileCount * VERTS_PER_TILE * 3);
    const corner = [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()];
    const scratch = new THREE.Color();
    let i = 0;

    for (let ty = rect.y0; ty < rect.y0 + rect.height; ty++) {
      for (let tx = rect.x0; tx < rect.x0 + rect.width; tx++) {
        const type = map.tileAt(tx, ty) ?? TileType.Water;
        const cx = [tx, tx + 1, tx, tx + 1];
        const cy = [ty, ty, ty + 1, ty + 1];
        const shade = terrainTileShade(map, type, tx, ty);
        for (let k = 0; k < 4; k++) terrainCornerColor(map, type, cx[k], cy[k], corner[k], scratch).multiplyScalar(shade);
        // Corners a, b, c, d; split along the b-c diagonal, which heightfieldRaycast tests too.
        for (const [n, k] of [0, 2, 1, 1, 2, 3].entries()) {
          const speckle = 1 + TERRAIN_MESH_CONFIG.speckle * 2 * (hash2(map.seed, tx * 2 + (n < 3 ? 0 : 1), ty) - 0.5);
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

    // Non-indexed, so computeVertexNormals gives each triangle its face normal.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const normals = geometry.getAttribute('normal').array as Float32Array;
    return { positions, colors, normals };
  }
}
