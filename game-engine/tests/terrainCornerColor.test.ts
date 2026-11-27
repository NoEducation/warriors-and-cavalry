import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { terrainVertexColor } from '../src/render/terrainColor';
import { terrainCornerColor } from '../src/render/terrainCornerColor';
import { GameMap } from '../src/sim/GameMap';
import { TileType } from '../src/sim/tiles';

/** A 6 x 6 map: grass on the left half, quarry ground on the right half. */
function halfQuarry(): GameMap {
  const tiles = new Uint8Array(36).fill(TileType.Grass);
  for (let y = 0; y < 6; y++) for (let x = 3; x < 6; x++) tiles[y * 6 + x] = TileType.Quarry;
  return new GameMap(6, 6, 2, new Float32Array(49).fill(2), tiles);
}

const color = (map: GameMap, type: TileType, cx: number, cy: number): THREE.Color =>
  terrainCornerColor(map, type, cx, cy, new THREE.Color(), new THREE.Color());

describe('terrainCornerColor', () => {
  const map = halfQuarry();

  it('gives a corner on the border one colour from both sides, so there is no seam', () => {
    expect(color(map, TileType.Grass, 3, 3).equals(color(map, TileType.Quarry, 3, 3))).toBe(true);
  });

  it('mixes the colours of the tiles around a border corner', () => {
    const grass = terrainVertexColor(map, TileType.Grass, 3, 3, new THREE.Color());
    const quarry = terrainVertexColor(map, TileType.Quarry, 3, 3, new THREE.Color());
    const mixed = color(map, TileType.Grass, 3, 3);
    expect(mixed.r).toBeCloseTo((grass.r + quarry.r) / 2, 5);
    expect(mixed.g).toBeCloseTo((grass.g + quarry.g) / 2, 5);
  });

  it('leaves corners away from quarry ground unchanged', () => {
    const plain = terrainVertexColor(map, TileType.Grass, 1, 3, new THREE.Color());
    expect(color(map, TileType.Grass, 1, 3).equals(plain)).toBe(true);
  });
});
