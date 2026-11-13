import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BuildingLayer } from '../src/render/BuildingLayer';
import { BuildingMeshFactory } from '../src/render/BuildingMeshFactory';
import { PlacementGhost } from '../src/render/PlacementGhost';
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

function meshesOf(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) meshes.push(node);
  });
  return meshes;
}

describe('PlacementGhost', () => {
  it('draws the building as one translucent mesh with its own material, tinted green or red', () => {
    const world = flatWorld();
    world.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 1, ty: 1 });
    const factory = new BuildingMeshFactory();
    const layer = new BuildingLayer(world, factory);
    const [building] = meshesOf(layer.object);
    const buildingMaterial = building.material as THREE.MeshLambertMaterial;
    const ghost = new PlacementGhost(factory);

    ghost.show(world, { kind: ObjectKind.Hovel, tx: 6, ty: 6, ok: true });
    const meshes = meshesOf(ghost.object);
    expect(meshes).toHaveLength(1);
    const material = meshes[0].material as THREE.MeshLambertMaterial;
    expect(material).not.toBe(buildingMaterial);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeLessThan(1);
    expect(material.color.g).toBeGreaterThan(material.color.r);

    ghost.show(world, { kind: ObjectKind.Hovel, tx: 6, ty: 6, ok: false });
    expect(material.color.r).toBeGreaterThan(material.color.g);
    expect(building.material).toBe(buildingMaterial);
    expect(buildingMaterial.transparent).toBe(false);
    expect(buildingMaterial.opacity).toBe(1);

    ghost.show(world, { kind: ObjectKind.Keep, tx: 6, ty: 6, ok: true });
    const keepMeshes = meshesOf(ghost.object);
    expect(keepMeshes).toHaveLength(1);
    expect((keepMeshes[0].material as THREE.Material).transparent).toBe(true);
    layer.dispose();
  });
});
