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

  it('turns a Gate ghost between walls to the west and east north-south, as the built gate will be', () => {
    const world = flatWorld();
    world.apply({ type: 'placeBuilding', kind: ObjectKind.Wall, tx: 4, ty: 5 });
    world.apply({ type: 'placeBuilding', kind: ObjectKind.Wall, tx: 6, ty: 5 });
    const ghost = new PlacementGhost(new BuildingMeshFactory());
    ghost.show(world, { kind: ObjectKind.Gate, tx: 5, ty: 5, ok: true });
    ghost.object.updateMatrixWorld(true);
    const along = (origin: THREE.Vector3, direction: THREE.Vector3): number =>
      new THREE.Raycaster(origin, direction).intersectObject(ghost.object).length;
    expect(along(new THREE.Vector3(5.5, 0.5, 4), new THREE.Vector3(0, 0, 1))).toBe(0);
    expect(along(new THREE.Vector3(4.5, 0.5, 5.5), new THREE.Vector3(1, 0, 0))).toBeGreaterThan(0);
  });

  it('rebuilds its mesh only when the kind or the gate passage changes', () => {
    const world = flatWorld();
    world.apply({ type: 'placeBuilding', kind: ObjectKind.Wall, tx: 4, ty: 5 });
    const ghost = new PlacementGhost(new BuildingMeshFactory());
    ghost.show(world, { kind: ObjectKind.Gate, tx: 9, ty: 9, ok: true });
    const [lone] = meshesOf(ghost.object);
    ghost.show(world, { kind: ObjectKind.Gate, tx: 10, ty: 9, ok: false });
    expect(meshesOf(ghost.object)).toEqual([lone]);
    ghost.show(world, { kind: ObjectKind.Gate, tx: 5, ty: 5, ok: true }); // beside the wall: turned
    const [turned] = meshesOf(ghost.object);
    expect(turned).not.toBe(lone);
    ghost.show(world, { kind: ObjectKind.Gate, tx: 3, ty: 5, ok: true }); // the wall is east of it: still turned
    expect(meshesOf(ghost.object)).toEqual([turned]);
  });
});
