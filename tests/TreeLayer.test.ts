import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TreeLayer } from '../src/render/TreeLayer';
import { GameMap } from '../src/sim/GameMap';
import { ObjectKind } from '../src/sim/ObjectKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';

const SIZE = 16;

function flatWorld(): World {
  const heights = new Float32Array((SIZE + 1) * (SIZE + 1));
  const tiles = new Uint8Array(SIZE * SIZE).fill(TileType.Grass);
  return new World(new GameMap(SIZE, SIZE, 1, heights, tiles));
}

function instancedMeshes(layer: TreeLayer): THREE.InstancedMesh[] {
  return layer.object.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
}

describe('TreeLayer', () => {
  it('draws one trunk and one foliage instance per tree', () => {
    const world = flatWorld();
    world.spawn(ObjectKind.Tree, 1, 1);
    world.spawn(ObjectKind.Tree, 5, 2);
    world.spawn(ObjectKind.Tree, 9, 12);
    world.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 12, ty: 3 });
    const layer = new TreeLayer(world);
    const meshes = instancedMeshes(layer);
    expect(meshes).toHaveLength(2);
    for (const mesh of meshes) expect(mesh.count).toBe(3);
    layer.dispose();
  });

  it('handles a world without trees', () => {
    const layer = new TreeLayer(flatWorld());
    const meshes = instancedMeshes(layer);
    expect(meshes).toHaveLength(2);
    for (const mesh of meshes) expect(mesh.count).toBe(0);
    layer.dispose();
  });
});
