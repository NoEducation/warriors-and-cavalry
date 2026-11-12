import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TREE_REGION_SIZE, TreeLayer } from '../src/render/TreeLayer';
import { GameMap } from '../src/sim/GameMap';
import { MapGenerator } from '../src/sim/MapGenerator';
import { ObjectKind } from '../src/sim/ObjectKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';

function flatWorld(size: number): World {
  const heights = new Float32Array((size + 1) * (size + 1));
  const tiles = new Uint8Array(size * size).fill(TileType.Grass);
  return new World(new GameMap(size, size, 1, heights, tiles));
}

function instancedMeshes(layer: TreeLayer): THREE.InstancedMesh[] {
  const meshes: THREE.InstancedMesh[] = [];
  layer.object.traverse((node) => {
    if (node instanceof THREE.InstancedMesh) meshes.push(node);
  });
  return meshes;
}

function treeCount(world: World): number {
  let n = 0;
  for (const object of world.objects()) if (object.kind === ObjectKind.Tree) n++;
  return n;
}

/** Region key ("rx,ry") of every instance of `mesh`, from the instance's position. */
function regionsOf(mesh: THREE.InstancedMesh): Set<string> {
  const keys = new Set<string>();
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix);
    position.setFromMatrixPosition(matrix);
    keys.add(`${Math.floor(position.x / TREE_REGION_SIZE)},${Math.floor(position.z / TREE_REGION_SIZE)}`);
  }
  return keys;
}

describe('TreeLayer', () => {
  it('uses 64-tile regions', () => {
    expect(TREE_REGION_SIZE).toBe(64);
  });

  it('draws one instance per tree', () => {
    const world = flatWorld(16);
    world.spawn(ObjectKind.Tree, 1, 1);
    world.spawn(ObjectKind.Tree, 5, 2);
    world.spawn(ObjectKind.Tree, 9, 12);
    world.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 12, ty: 3 });
    const layer = new TreeLayer(world);
    expect(instancedMeshes(layer).reduce((sum, m) => sum + m.count, 0)).toBe(3);
    layer.dispose();
  });

  it('draws one instance per tree of a generated world', () => {
    const world = new MapGenerator().generate({ seed: 1, width: 256, height: 256 });
    const layer = new TreeLayer(world);
    const meshes = instancedMeshes(layer);
    expect(meshes.reduce((sum, m) => sum + m.count, 0)).toBe(treeCount(world));
    for (const mesh of meshes) {
      expect(mesh.count).toBeGreaterThan(0);
      expect(mesh.instanceColor, 'per-instance tint').not.toBeNull();
      expect(mesh.boundingSphere, 'own bounding sphere').not.toBeNull();
    }
    layer.dispose();
  });

  it('handles a world without trees', () => {
    const layer = new TreeLayer(flatWorld(16));
    expect(instancedMeshes(layer)).toHaveLength(0);
    expect(() => layer.dispose()).not.toThrow();
  });

  it('puts trees of different regions into different meshes', () => {
    const world = flatWorld(160);
    const spots = [
      [1, 1],
      [70, 1],
      [1, 130],
      [150, 150],
    ];
    for (const [tx, ty] of spots) world.spawn(ObjectKind.Tree, tx, ty);
    const layer = new TreeLayer(world);
    const meshes = instancedMeshes(layer);
    expect(meshes).toHaveLength(4);
    const allRegions = new Set<string>();
    for (const mesh of meshes) {
      const regions = regionsOf(mesh);
      expect(regions.size).toBe(1);
      for (const key of regions) allRegions.add(key);
    }
    expect(allRegions.size).toBe(4);
    layer.dispose();
  });

  it('bounds each region mesh by its own trees', () => {
    const world = flatWorld(160);
    world.spawn(ObjectKind.Tree, 1, 1);
    world.spawn(ObjectKind.Tree, 150, 150);
    const layer = new TreeLayer(world);
    for (const mesh of instancedMeshes(layer)) expect(mesh.boundingSphere!.radius).toBeLessThan(3);
    layer.dispose();
  });

  it('is empty after dispose', () => {
    const world = new MapGenerator().generate({ seed: 2, width: 128, height: 128 });
    const layer = new TreeLayer(world);
    expect(instancedMeshes(layer).length).toBeGreaterThan(0);
    layer.dispose();
    expect(layer.object.children).toHaveLength(0);
  });
});
