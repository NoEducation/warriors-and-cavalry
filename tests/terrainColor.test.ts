import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TERRAIN_LOOK_CONFIG, terrainVertexColor } from '../src/render/terrainColor';
import { GameMap } from '../src/sim/GameMap';
import { TileType } from '../src/sim/tiles';

/** A map whose corner heights come from `height(cx, cy)`. */
function mapOf(size: number, height: (cx: number, cy: number) => number, seed = 7): GameMap {
  const heights = new Float32Array((size + 1) * (size + 1));
  for (let cy = 0; cy <= size; cy++) for (let cx = 0; cx <= size; cx++) heights[cy * (size + 1) + cx] = height(cx, cy);
  return new GameMap(size, size, seed, heights, new Uint8Array(size * size));
}

function colorAt(map: GameMap, type: TileType, cx: number, cy: number): THREE.Color {
  return terrainVertexColor(map, type, cx, cy, new THREE.Color());
}

function brightness(c: THREE.Color): number {
  return c.r + c.g + c.b;
}

describe('terrainVertexColor', () => {
  it('is a pure function of map and corner', () => {
    const map = mapOf(16, (x, y) => 2 + Math.sin(x) + Math.cos(y));
    expect(colorAt(map, TileType.Grass, 5, 6).equals(colorAt(map, TileType.Grass, 5, 6))).toBe(true);
  });

  it('keeps grass green everywhere', () => {
    const map = mapOf(40, (x, y) => 1 + 0.1 * x + 0.05 * y);
    for (let cy = 0; cy <= 40; cy += 3) {
      for (let cx = 0; cx <= 40; cx += 3) {
        const c = colorAt(map, TileType.Grass, cx, cy);
        expect(c.g).toBeGreaterThan(c.r);
        expect(c.g).toBeGreaterThan(c.b);
      }
    }
  });

  it('varies grass across the map', () => {
    const map = mapOf(64, () => 2);
    const greens = new Set<number>();
    for (let cx = 0; cx <= 64; cx += 4) greens.add(Math.round(colorAt(map, TileType.Grass, cx, 32).g * 100));
    expect(greens.size).toBeGreaterThan(3);
  });

  it('turns high flat rock to snow but leaves low rock bare', () => {
    const high = mapOf(8, () => TERRAIN_LOOK_CONFIG.snowLine + 2);
    const low = mapOf(8, () => TERRAIN_LOOK_CONFIG.snowLine - 3);
    expect(brightness(colorAt(high, TileType.Rock, 4, 4))).toBeGreaterThan(2);
    expect(brightness(colorAt(low, TileType.Rock, 4, 4))).toBeLessThan(1.5);
  });

  it('shades steep rock darker than gentle rock at the same height', () => {
    const steep = mapOf(8, (x) => 6 + 1.5 * (x - 4));
    const gentle = mapOf(8, (x) => 6 + 0.1 * (x - 4));
    expect(brightness(colorAt(steep, TileType.Rock, 4, 4))).toBeLessThan(brightness(colorAt(gentle, TileType.Rock, 4, 4)));
  });

  it('darkens hollows and lightens ridges', () => {
    const hollow = mapOf(8, (x, y) => 3 + 0.3 * ((x - 4) ** 2 + (y - 4) ** 2) ** 0.5);
    const ridge = mapOf(8, (x, y) => 3 - 0.3 * ((x - 4) ** 2 + (y - 4) ** 2) ** 0.5);
    expect(brightness(colorAt(hollow, TileType.Grass, 4, 4))).toBeLessThan(brightness(colorAt(ridge, TileType.Grass, 4, 4)));
  });

  it('wets sand at the waterline', () => {
    const shore = mapOf(8, () => 0.02);
    const dune = mapOf(8, () => 0.45);
    expect(brightness(colorAt(shore, TileType.Sand, 4, 4))).toBeLessThan(brightness(colorAt(dune, TileType.Sand, 4, 4)));
  });
});
