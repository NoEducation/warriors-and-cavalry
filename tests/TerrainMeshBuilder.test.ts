import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TERRAIN_MESH_CONFIG, TerrainMeshBuilder } from '../src/render/TerrainMeshBuilder';
import { GameMap } from '../src/sim/GameMap';

function flatMap(width: number, height: number): GameMap {
  return new GameMap(width, height, 1, new Float32Array((width + 1) * (height + 1)), new Uint8Array(width * height));
}

function meshes(group: THREE.Group): THREE.Mesh[] {
  return group.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh);
}

function vertexCount(group: THREE.Group): number {
  return meshes(group).reduce((sum, m) => sum + m.geometry.getAttribute('position').count, 0);
}

describe('TerrainMeshBuilder', () => {
  const builder = new TerrainMeshBuilder();

  it('uses 32-tile chunks', () => {
    expect(TERRAIN_MESH_CONFIG.chunkSize).toBe(32);
  });

  it('splits a 64 x 64 map into 4 chunks', () => {
    const group = builder.build(flatMap(64, 64));
    expect(meshes(group)).toHaveLength(4);
    expect(group.children).toHaveLength(4);
    expect(vertexCount(group)).toBe(64 * 64 * 6);
  });

  it('makes smaller edge chunks for a 40 x 40 map', () => {
    const group = builder.build(flatMap(40, 40));
    expect(meshes(group)).toHaveLength(4);
    expect(vertexCount(group)).toBe(40 * 40 * 6);
  });

  it('covers non-square maps', () => {
    const group = builder.build(flatMap(70, 10));
    expect(meshes(group)).toHaveLength(3);
    expect(vertexCount(group)).toBe(70 * 10 * 6);
  });

  it('shares one material between all chunks', () => {
    const all = meshes(builder.build(flatMap(64, 64)));
    for (const mesh of all) expect(mesh.material).toBe(all[0].material);
  });

  it('places chunk vertices at world tile positions', () => {
    const all = meshes(builder.build(flatMap(40, 40)));
    let maxX = 0;
    let maxZ = 0;
    for (const mesh of all) {
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox as THREE.Box3;
      maxX = Math.max(maxX, box.max.x + mesh.position.x);
      maxZ = Math.max(maxZ, box.max.z + mesh.position.z);
    }
    expect(maxX).toBe(40);
    expect(maxZ).toBe(40);
  });
});

describe('TerrainMeshBuilder data', () => {
  const builder = new TerrainMeshBuilder();

  function hillyMap(): GameMap {
    const w = 40;
    const h = 36;
    const heights = new Float32Array((w + 1) * (h + 1)).map((_, i) => ((i * 7919) % 13) / 4);
    const tiles = new Uint8Array(w * h).map((_, i) => i % 4);
    return new GameMap(w, h, 3, heights, tiles);
  }

  it('gives the same geometry from chunk data as build does', () => {
    const map = hillyMap();
    const direct = meshes(builder.build(map));
    const data = builder.buildData(map);
    const copied = data.map((c) => ({ positions: c.positions.slice(), colors: c.colors.slice(), normals: c.normals.slice() }));
    const viaData = meshes(builder.fromData(copied));
    expect(viaData).toHaveLength(direct.length);
    for (let i = 0; i < direct.length; i++) {
      for (const name of ['position', 'color', 'normal']) {
        expect(Array.from(viaData[i].geometry.getAttribute(name).array)).toEqual(
          Array.from(direct[i].geometry.getAttribute(name).array),
        );
      }
    }
  });

  it('builds plain typed arrays, one chunk per block, row by row', () => {
    const data = builder.buildData(hillyMap());
    expect(data).toHaveLength(4);
    for (const chunk of data) {
      expect(chunk.positions).toBeInstanceOf(Float32Array);
      expect(chunk.normals.length).toBe(chunk.positions.length);
      expect(chunk.colors.length).toBe(chunk.positions.length);
    }
    expect(data[1].positions[0]).toBe(32);
  });
});
