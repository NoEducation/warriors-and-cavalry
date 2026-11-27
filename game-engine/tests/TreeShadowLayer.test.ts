import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TreeShadowLayer } from '../src/render/TreeShadowLayer';
import { GameMap } from '../src/sim/GameMap';
import { ObjectKind } from '../src/sim/ObjectKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';

function world(size: number, height: (cx: number, cy: number) => number = () => 1): World {
  const heights = new Float32Array((size + 1) * (size + 1));
  for (let cy = 0; cy <= size; cy++) for (let cx = 0; cx <= size; cx++) heights[cy * (size + 1) + cx] = height(cx, cy);
  return new World(new GameMap(size, size, 1, heights, new Uint8Array(size * size).fill(TileType.Grass)));
}

function meshes(layer: TreeShadowLayer): THREE.InstancedMesh[] {
  return layer.object.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
}

function firstPosition(mesh: THREE.InstancedMesh): THREE.Vector3 {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(0, matrix);
  return new THREE.Vector3().setFromMatrixPosition(matrix);
}

describe('TreeShadowLayer', () => {
  it('draws one shadow per tree, one mesh per region', () => {
    const w = world(160);
    for (const [tx, ty] of [[1, 1], [3, 2], [150, 150]]) w.spawn(ObjectKind.Tree, tx, ty);
    const layer = new TreeShadowLayer(w);
    expect(meshes(layer)).toHaveLength(2);
    expect(meshes(layer).reduce((sum, m) => sum + m.count, 0)).toBe(3);
    layer.dispose();
    expect(layer.object.children).toHaveLength(0);
  });

  it('lies just above the ground, shifted away from the sun', () => {
    const w = world(8);
    w.spawn(ObjectKind.Tree, 4, 4);
    const layer = new TreeShadowLayer(w);
    const p = firstPosition(meshes(layer)[0]);
    expect(p.y).toBeGreaterThan(1);
    expect(p.y).toBeLessThan(1.1);
    expect(p.x).toBeGreaterThan(4.5);
    expect(p.z).toBeGreaterThan(4.5);
    layer.dispose();
  });

  it('follows the slope of its tile', () => {
    const w = world(8, (cx) => cx * 0.5);
    w.spawn(ObjectKind.Tree, 4, 4);
    const layer = new TreeShadowLayer(w);
    const matrix = new THREE.Matrix4();
    meshes(layer)[0].getMatrixAt(0, matrix);
    const up = new THREE.Vector3(0, 1, 0).transformDirection(matrix);
    expect(up.x).toBeLessThan(-0.3);
    layer.dispose();
  });

  it('handles a world without trees', () => {
    const layer = new TreeShadowLayer(world(16));
    expect(meshes(layer)).toHaveLength(0);
    expect(() => layer.dispose()).not.toThrow();
  });
});
