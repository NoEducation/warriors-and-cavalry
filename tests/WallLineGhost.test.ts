import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BuildingMeshFactory } from '../src/render/BuildingMeshFactory';
import { WallLineGhost } from '../src/render/WallLineGhost';
import { GameMap } from '../src/sim/GameMap';
import { resources } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import type { WallLinePreview } from '../src/sim/WallBuilder';
import { WALL_LINE_MAX_TILES } from '../src/sim/wallLine';
import { World } from '../src/sim/World';

const SIZE = 16;

function flatWorld(): World {
  const heights = new Float32Array((SIZE + 1) * (SIZE + 1));
  const tiles = new Uint8Array(SIZE * SIZE).fill(TileType.Grass);
  return new World(new GameMap(SIZE, SIZE, 1, heights, tiles));
}

/** A preview along row `ty` from tx = 0 with the given per-tile placeability. */
function rowPreview(ty: number, placeable: readonly boolean[]): WallLinePreview {
  const placedCount = placeable.filter(Boolean).length;
  return {
    tiles: placeable.map((_, tx) => ({ tx, ty })),
    placeable,
    placedCount,
    cost: resources(0, placedCount * 2, 0),
  };
}

function instancedMeshes(ghost: WallLineGhost): THREE.InstancedMesh[] {
  return ghost.object.children.filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh);
}

/** The two meshes as [green, red], told apart by their tint. */
function greenAndRed(ghost: WallLineGhost): [THREE.InstancedMesh, THREE.InstancedMesh] {
  const meshes = instancedMeshes(ghost);
  const tint = (mesh: THREE.InstancedMesh): THREE.Color => (mesh.material as THREE.MeshLambertMaterial).color;
  const green = meshes.find((mesh) => tint(mesh).g > tint(mesh).r);
  const red = meshes.find((mesh) => tint(mesh).r > tint(mesh).g);
  if (!green || !red) throw new Error('expected a green and a red mesh');
  return [green, red];
}

describe('WallLineGhost', () => {
  it('draws placeable pieces green and the rest red, in two translucent instanced meshes', () => {
    const world = flatWorld();
    const ghost = new WallLineGhost(new BuildingMeshFactory());
    expect(instancedMeshes(ghost)).toHaveLength(2);
    ghost.show(world, rowPreview(3, [true, true, false, true, false]));
    const [green, red] = greenAndRed(ghost);
    expect(green.count).toBe(3);
    expect(red.count).toBe(2);
    for (const mesh of [green, red]) {
      expect(mesh.instanceMatrix.count).toBe(WALL_LINE_MAX_TILES);
      const material = mesh.material as THREE.Material;
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBeLessThan(1);
    }
    expect(green.material).not.toBe(red.material);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    red.getMatrixAt(1, matrix);
    expect(position.setFromMatrixPosition(matrix).toArray()).toEqual([4, 0, 3]);
    expect(ghost.object.visible).toBe(true);
    ghost.dispose();
  });

  it('reuses the same meshes for a new preview, and hides by showing nothing', () => {
    const world = flatWorld();
    const ghost = new WallLineGhost(new BuildingMeshFactory());
    ghost.show(world, rowPreview(3, [true, true, false, true, false]));
    const [green, red] = greenAndRed(ghost);
    ghost.show(world, rowPreview(4, [false, true]));
    expect(greenAndRed(ghost)).toEqual([green, red]);
    expect(green.count).toBe(1);
    expect(red.count).toBe(1);
    ghost.hide();
    expect(green.count).toBe(0);
    expect(red.count).toBe(0);
    expect(ghost.object.visible).toBe(false);
    ghost.dispose();
  });

  it('empties its group on dispose', () => {
    const ghost = new WallLineGhost(new BuildingMeshFactory());
    ghost.dispose();
    expect(ghost.object.children).toHaveLength(0);
  });
});
