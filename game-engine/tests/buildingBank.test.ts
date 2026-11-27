import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BANK_CONFIG, bankGeometry, bankMesh } from '../src/render/buildingBank';
import { floorHeight } from '../src/render/floorHeight';
import { GameMap } from '../src/sim/GameMap';
import { ObjectKind } from '../src/sim/ObjectKind';
import { TileType } from '../src/sim/tiles';

/** A 16 x 16 grass map whose corner heights are `height(cx, cy)`. */
function mapOf(height: (cx: number, cy: number) => number): GameMap {
  const heights = new Float32Array(17 * 17);
  for (let cy = 0; cy <= 16; cy++) for (let cx = 0; cx <= 16; cx++) heights[cy * 17 + cx] = height(cx, cy);
  return new GameMap(16, 16, 1, heights, new Uint8Array(16 * 16).fill(TileType.Grass));
}

function positions(geometry: THREE.BufferGeometry): THREE.Vector3[] {
  const attribute = geometry.getAttribute('position');
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < attribute.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(attribute, i));
  return out;
}

describe('buildingBank', () => {
  it('is 0.7 tile wide', () => {
    expect(BANK_CONFIG.width).toBe(0.7);
  });

  it('lies flat against the floor on flat ground', () => {
    const map = mapOf(() => 2);
    const geometry = bankGeometry(map, ObjectKind.Hovel, 5, 5, floorHeight(map, ObjectKind.Hovel, 5, 5));
    for (const p of positions(geometry)) expect(Math.abs(p.y)).toBeLessThan(0.1);
    geometry.dispose();
  });

  it('has one quad per footprint edge and one per corner', () => {
    const map = mapOf(() => 0);
    const geometry = bankGeometry(map, ObjectKind.Keep, 5, 5, 0);
    expect(geometry.getAttribute('position').count).toBe((2 * (4 + 4) + 4) * 6);
    geometry.dispose();
  });

  it('slopes down to the ground on the downhill side and reaches out by its width', () => {
    // Ground falls 0.5 per tile toward -x.
    const map = mapOf((cx) => cx * 0.5);
    const floor = floorHeight(map, ObjectKind.Hovel, 6, 6);
    const points = positions(bankGeometry(map, ObjectKind.Hovel, 6, 6, floor));
    const downhill = points.filter((p) => p.x < -0.5);
    expect(downhill.length).toBeGreaterThan(0);
    for (const p of downhill) {
      expect(p.x).toBeCloseTo(-BANK_CONFIG.width);
      expect(p.y).toBeLessThan(-1);
    }
    for (const p of points) expect(p.y).toBeLessThanOrEqual(0);
  });

  it('faces up everywhere', () => {
    const map = mapOf((cx, cy) => (cx * 0.3 + cy * 0.2) % 2);
    const geometry = bankGeometry(map, ObjectKind.Granary, 4, 4, floorHeight(map, ObjectKind.Granary, 4, 4));
    const p = positions(geometry);
    for (let i = 0; i < p.length; i += 3) {
      const normal = new THREE.Vector3().subVectors(p[i + 1], p[i]).cross(new THREE.Vector3().subVectors(p[i + 2], p[i]));
      expect(normal.y).toBeGreaterThanOrEqual(0);
    }
    geometry.dispose();
  });

  it('stays finite at the map corner', () => {
    const map = mapOf((cx, cy) => cx + cy);
    const geometry = bankGeometry(map, ObjectKind.Wall, 0, 0, floorHeight(map, ObjectKind.Wall, 0, 0));
    for (const p of positions(geometry)) expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
    geometry.dispose();
  });

  it('makes a vertex-coloured mesh', () => {
    const mesh = bankMesh(mapOf(() => 0), ObjectKind.Hovel, 5, 5, 0);
    expect(mesh.geometry.getAttribute('color').count).toBe(mesh.geometry.getAttribute('position').count);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
});
