// Flat-shaded terrain built from a GameMap's corner heights and tile types, split into square chunks.
import * as THREE from 'three';
import type { GameMap } from '../sim/GameMap';
import { hash2 } from '../sim/rng';
import { TileType } from '../sim/tiles';

/** Tiles per chunk side. Chunks let three.js skip the parts of the map outside the view. */
export const TERRAIN_CHUNK_SIZE = 32;

const TILE_COLORS: Record<TileType, number> = {
  [TileType.Water]: 0x8a7f5c, // seabed
  [TileType.Sand]: 0xd9c98a,
  [TileType.Grass]: 0x5d9c3f,
  [TileType.Rock]: 0x8c8c88,
};

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
    const color = new THREE.Color();
    let i = 0;

    for (let ty = rect.y0; ty < rect.y0 + rect.height; ty++) {
      for (let tx = rect.x0; tx < rect.x0 + rect.width; tx++) {
        const type = map.tileAt(tx, ty) ?? TileType.Water;
        color.set(TILE_COLORS[type]).multiplyScalar(0.94 + 0.12 * hash2(map.seed, tx, ty));

        const a = [tx, map.heightAt(tx, ty), ty];
        const b = [tx + 1, map.heightAt(tx + 1, ty), ty];
        const c = [tx, map.heightAt(tx, ty + 1), ty + 1];
        const d = [tx + 1, map.heightAt(tx + 1, ty + 1), ty + 1];
        // Split along the b-c diagonal; heightfieldRaycast tests the same two triangles.
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
    geometry.computeBoundingSphere();
    return geometry;
  }
}
