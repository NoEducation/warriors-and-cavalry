import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BuildingLayer } from '../src/render/BuildingLayer';
import { BuildingMeshFactory } from '../src/render/BuildingMeshFactory';
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

describe('BuildingLayer', () => {
  it('follows buildings placed and demolished in the world', () => {
    const world = flatWorld();
    world.spawn(ObjectKind.Tree, 1, 1);
    const layer = new BuildingLayer(world, new BuildingMeshFactory());
    expect(layer.buildingCount).toBe(0);

    const placed = world.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 4, ty: 4 });
    expect(layer.buildingCount).toBe(1);
    expect(layer.object.children).toHaveLength(1);

    if (!placed.ok) throw new Error('placement failed');
    world.apply({ type: 'demolish', objectId: placed.object.id });
    expect(layer.buildingCount).toBe(0);
    expect(layer.object.children).toHaveLength(0);

    layer.dispose();
    world.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 8, ty: 8 });
    expect(layer.buildingCount).toBe(0);
  });

  it('shows buildings that already exist and puts the floor at the highest footprint corner', () => {
    const world = flatWorld();
    world.map.heights[5 * (SIZE + 1) + 6] = 0.4; // corner (6, 5) of a Hovel at (4, 4)
    world.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 4, ty: 4 });
    const layer = new BuildingLayer(world, new BuildingMeshFactory());
    expect(layer.buildingCount).toBe(1);
    const mesh = layer.object.children[0];
    expect(mesh.position.x).toBe(4);
    expect(mesh.position.z).toBe(4);
    expect(mesh.position.y).toBeCloseTo(0.4);
    layer.dispose();
  });

  it('turns a new Gate between two walls to the west and east of it north-south', () => {
    const world = flatWorld();
    world.apply({ type: 'placeBuilding', kind: ObjectKind.Wall, tx: 4, ty: 5 });
    world.apply({ type: 'placeBuilding', kind: ObjectKind.Wall, tx: 6, ty: 5 });
    const layer = new BuildingLayer(world, new BuildingMeshFactory());
    world.apply({ type: 'placeBuilding', kind: ObjectKind.Gate, tx: 5, ty: 5 });
    const gate = layer.object.children[2] as THREE.Mesh;
    gate.updateMatrixWorld();
    const along = (origin: THREE.Vector3, direction: THREE.Vector3): number =>
      new THREE.Raycaster(origin, direction).intersectObject(gate).length;
    expect(along(new THREE.Vector3(5.5, 0.5, 4), new THREE.Vector3(0, 0, 1))).toBe(0);
    expect(along(new THREE.Vector3(5.5, 0.5, 5.5), new THREE.Vector3(1, 0, 0))).toBeGreaterThan(0);
    layer.dispose();
  });

  it('turns a lone Gate east-west', () => {
    const world = flatWorld();
    const layer = new BuildingLayer(world, new BuildingMeshFactory());
    world.apply({ type: 'placeBuilding', kind: ObjectKind.Gate, tx: 5, ty: 5 });
    const gate = layer.object.children[0] as THREE.Mesh;
    gate.updateMatrixWorld();
    const ray = new THREE.Raycaster(new THREE.Vector3(4, 0.5, 5.5), new THREE.Vector3(1, 0, 0));
    expect(ray.intersectObject(gate)).toHaveLength(0);
    layer.dispose();
  });
});
