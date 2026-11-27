import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { mistBanks } from '../src/render/mistBanks';
import { MountainMist } from '../src/render/MountainMist';
import { GameMap } from '../src/sim/GameMap';
import { TileType } from '../src/sim/tiles';

function mapOf(size: number, tile: TileType): GameMap {
  const heights = new Float32Array((size + 1) * (size + 1)).fill(8);
  return new GameMap(size, size, 5, heights, new Uint8Array(size * size).fill(tile));
}

function meshesOf(mist: MountainMist): THREE.InstancedMesh[] {
  return mist.object.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
}

describe('MountainMist', () => {
  it('draws every mist bank of a mountain map in one see-through instanced mesh', () => {
    const map = mapOf(48, TileType.Rock);
    const mist = new MountainMist(map);
    const meshes = meshesOf(mist);
    expect(meshes).toHaveLength(1);
    expect(meshes[0].count).toBe(mistBanks(map).length);
    const material = meshes[0].material as THREE.ShaderMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    mist.dispose();
  });

  it('draws nothing on a map without mountains', () => {
    const mist = new MountainMist(mapOf(48, TileType.Grass));
    expect(meshesOf(mist)).toHaveLength(0);
    mist.dispose();
  });

  it('lets the wisps drift with time and frees its geometry and material on dispose', () => {
    const mist = new MountainMist(mapOf(48, TileType.Rock));
    const mesh = meshesOf(mist)[0];
    const before = mist.time;
    mist.advance(0.05);
    expect(mist.time).toBeGreaterThan(before);
    let freed = 0;
    mesh.geometry.addEventListener('dispose', () => freed++);
    (mesh.material as THREE.Material).addEventListener('dispose', () => freed++);
    mist.dispose();
    expect(freed).toBe(2);
    expect(mist.object.children).toHaveLength(0);
  });
});
