import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BuildingMeshFactory } from '../src/render/BuildingMeshFactory';
import { OBJECT_KINDS, ObjectKind } from '../src/sim/ObjectKind';

const BUILDABLE_KINDS = Object.values(ObjectKind).filter((kind) => OBJECT_KINDS[kind].buildable);

function meshCount(group: THREE.Object3D): number {
  let count = 0;
  group.traverse((node) => {
    if (node instanceof THREE.Mesh) count++;
  });
  return count;
}

function triangleCount(group: THREE.Object3D): number {
  let count = 0;
  group.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const geometry = node.geometry as THREE.BufferGeometry;
    count += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
  });
  return count;
}

function size(kind: ObjectKind): THREE.Vector3 {
  return new THREE.Box3().setFromObject(new BuildingMeshFactory().create(kind)).getSize(new THREE.Vector3());
}

describe('BuildingMeshFactory', () => {
  const factory = new BuildingMeshFactory();

  it('has ten buildable kinds', () => {
    expect(BUILDABLE_KINDS).toHaveLength(10);
  });

  it('creates a non-empty, low-poly group within the footprint for every buildable kind', () => {
    for (const kind of BUILDABLE_KINDS) {
      const info = OBJECT_KINDS[kind];
      const group = factory.create(kind);
      expect(meshCount(group), info.name).toBeGreaterThan(0);
      expect(triangleCount(group), info.name).toBeLessThan(150);
      const box = new THREE.Box3().setFromObject(group);
      expect(box.min.x, info.name).toBeGreaterThanOrEqual(0);
      expect(box.min.z, info.name).toBeGreaterThanOrEqual(0);
      expect(box.max.x, info.name).toBeLessThanOrEqual(info.width);
      expect(box.max.z, info.name).toBeLessThanOrEqual(info.height);
    }
  });

  it('reaches at least 1.5 below the floor with every shape', () => {
    for (const kind of BUILDABLE_KINDS) {
      const box = new THREE.Box3().setFromObject(factory.create(kind));
      expect(box.min.y, OBJECT_KINDS[kind].name).toBeLessThanOrEqual(-1.5);
    }
  });

  it('makes each building one mesh: one merged geometry with vertex colours, one flat-shaded Lambert material', () => {
    for (const kind of BUILDABLE_KINDS) {
      const name = OBJECT_KINDS[kind].name;
      const model = factory.create(kind);
      expect(meshCount(model), name).toBe(1);
      const meshes: THREE.Mesh[] = [];
      model.traverse((node) => {
        if (node instanceof THREE.Mesh) meshes.push(node);
      });
      const [mesh] = meshes;
      expect(mesh.geometry.getAttribute('color'), name).toBeDefined();
      expect(mesh.geometry.getAttribute('color').count, name).toBe(mesh.geometry.getAttribute('position').count);
      expect(mesh.material, name).toBeInstanceOf(THREE.MeshLambertMaterial);
      const material = mesh.material as THREE.MeshLambertMaterial;
      expect(material.vertexColors, name).toBe(true);
      expect(material.flatShading, name).toBe(true);
    }
  });

  it('throws for a tree', () => {
    expect(() => factory.create(ObjectKind.Tree)).toThrow();
  });

  it('makes the Keep wider than the Hovel', () => {
    const keep = size(ObjectKind.Keep);
    const hovel = size(ObjectKind.Hovel);
    expect(keep.x).toBeGreaterThan(hovel.x);
    expect(keep.z).toBeGreaterThan(hovel.z);
  });

  it('makes the Wheat farm wider than the Granary', () => {
    const farm = size(ObjectKind.WheatFarm);
    const granary = size(ObjectKind.Granary);
    expect(farm.x).toBeGreaterThan(granary.x);
    expect(farm.z).toBeGreaterThan(granary.z);
  });
});
