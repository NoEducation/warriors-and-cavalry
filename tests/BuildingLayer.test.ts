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

function meshCount(group: THREE.Object3D): number {
  let count = 0;
  group.traverse((node) => {
    if (node instanceof THREE.Mesh) count++;
  });
  return count;
}

describe('BuildingMeshFactory', () => {
  const factory = new BuildingMeshFactory();

  it('creates a non-empty group for every buildable kind', () => {
    for (const kind of [ObjectKind.Keep, ObjectKind.Hovel, ObjectKind.WoodcutterHut]) {
      expect(meshCount(factory.create(kind))).toBeGreaterThan(0);
    }
  });

  it('throws for a tree', () => {
    expect(() => factory.create(ObjectKind.Tree)).toThrow();
  });

  it('makes the Keep wider than the Hovel', () => {
    const keep = new THREE.Box3().setFromObject(factory.create(ObjectKind.Keep)).getSize(new THREE.Vector3());
    const hovel = new THREE.Box3().setFromObject(factory.create(ObjectKind.Hovel)).getSize(new THREE.Vector3());
    expect(keep.x).toBeGreaterThan(hovel.x);
    expect(keep.z).toBeGreaterThan(hovel.z);
  });

  it('stays within the footprint and reaches below the floor', () => {
    const box = new THREE.Box3().setFromObject(factory.create(ObjectKind.Hovel));
    expect(box.min.x).toBeGreaterThanOrEqual(0);
    expect(box.min.z).toBeGreaterThanOrEqual(0);
    expect(box.max.x).toBeLessThanOrEqual(2);
    expect(box.max.z).toBeLessThanOrEqual(2);
    expect(box.min.y).toBeCloseTo(-1);
  });
});

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
});
