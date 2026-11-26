import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BuildingMeshFactory } from '../src/render/BuildingMeshFactory';
import { StockpileShape } from '../src/render/buildings/StockpileShape';
import { OBJECT_KINDS, ObjectKind } from '../src/sim/ObjectKind';

/** Float32 rounding slack for shapes that fill their footprint exactly (walls and gates). */
const EPSILON = 1e-6;
const BUILDABLE_KINDS = Object.values(ObjectKind).filter((kind) => OBJECT_KINDS[kind].buildable);

/** Most triangles a building may have: walls get built by the hundred, so they stay lean. */
function triangleBudget(kind: ObjectKind): number {
  if (kind === ObjectKind.Wall) return 150;
  if (kind === ObjectKind.Gate) return 400;
  return 1500;
}

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

/** Whether a ray from `origin` along `direction` hits `mesh`. */
function hits(mesh: THREE.Mesh, origin: THREE.Vector3, direction: THREE.Vector3): boolean {
  mesh.updateMatrixWorld();
  return new THREE.Raycaster(origin, direction).intersectObject(mesh).length > 0;
}

describe('BuildingMeshFactory', () => {
  const factory = new BuildingMeshFactory();

  it('has ten buildable kinds', () => {
    expect(BUILDABLE_KINDS).toHaveLength(10);
  });

  it('creates a non-empty group within its triangle budget and within the footprint for every buildable kind', () => {
    for (const kind of BUILDABLE_KINDS) {
      const info = OBJECT_KINDS[kind];
      const group = factory.create(kind);
      expect(meshCount(group), info.name).toBeGreaterThan(0);
      expect(triangleCount(group), info.name).toBeLessThanOrEqual(triangleBudget(kind));
      const box = new THREE.Box3().setFromObject(group);
      expect(box.min.x, info.name).toBeGreaterThanOrEqual(-EPSILON);
      expect(box.min.z, info.name).toBeGreaterThanOrEqual(-EPSILON);
      expect(box.max.x, info.name).toBeLessThanOrEqual(info.width + EPSILON);
      expect(box.max.z, info.name).toBeLessThanOrEqual(info.height + EPSILON);
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

  it('fills the whole tile with a Wall so neighbouring pieces join', () => {
    const box = new THREE.Box3().setFromObject(factory.create(ObjectKind.Wall));
    expect(box.min.x).toBeCloseTo(0);
    expect(box.min.z).toBeCloseTo(0);
    expect(box.max.x).toBeCloseTo(1);
    expect(box.max.z).toBeCloseTo(1);
  });

  it('makes the Tower taller than the Wall', () => {
    expect(size(ObjectKind.Tower).y).toBeGreaterThan(size(ObjectKind.Wall).y);
  });

  it('opens an east-west Gate along x and closes it along z at mid-height', () => {
    const gate = factory.create(ObjectKind.Gate, 'eastWest');
    expect(hits(gate, new THREE.Vector3(-1, 0.5, 0.5), new THREE.Vector3(1, 0, 0))).toBe(false);
    expect(hits(gate, new THREE.Vector3(0.5, 0.5, -1), new THREE.Vector3(0, 0, 1))).toBe(true);
  });

  it('opens a north-south Gate along z and closes it along x at mid-height', () => {
    const gate = factory.create(ObjectKind.Gate, 'northSouth');
    expect(hits(gate, new THREE.Vector3(0.5, 0.5, -1), new THREE.Vector3(0, 0, 1))).toBe(false);
    expect(hits(gate, new THREE.Vector3(-1, 0.5, 0.5), new THREE.Vector3(1, 0, 0))).toBe(true);
  });

  it('opens a Gate east-west when no passage is given', () => {
    const gate = factory.create(ObjectKind.Gate);
    expect(hits(gate, new THREE.Vector3(-1, 0.5, 0.5), new THREE.Vector3(1, 0, 0))).toBe(false);
  });

  it('makes the Wheat farm wider than the Granary', () => {
    const farm = size(ObjectKind.WheatFarm);
    const granary = size(ObjectKind.Granary);
    expect(farm.x).toBeGreaterThan(granary.x);
    expect(farm.z).toBeGreaterThan(granary.z);
  });
});

/** Fewest triangles each building must have, so none stays a handful of plain boxes. */
const DETAIL_FLOOR: ReadonlyArray<readonly [ObjectKind, number]> = [
  [ObjectKind.Hovel, 300],
  [ObjectKind.WoodcutterHut, 300],
  [ObjectKind.Granary, 300],
  [ObjectKind.Stockpile, 150],
];

describe('building detail', () => {
  for (const [kind, floor] of DETAIL_FLOOR) {
    it(`gives the ${OBJECT_KINDS[kind].name} at least ${floor} triangles of detail`, () => {
      expect(triangleCount(new BuildingMeshFactory().create(kind))).toBeGreaterThanOrEqual(floor);
    });
  }

  it('keeps the Stockpile deck flat at its stated top for the stacks', () => {
    const mesh = new BuildingMeshFactory().create(ObjectKind.Stockpile);
    mesh.updateMatrixWorld();
    const hit = new THREE.Raycaster(new THREE.Vector3(1.5, 5, 1.5), new THREE.Vector3(0, -1, 0)).intersectObject(mesh)[0];
    expect(hit.point.y).toBeCloseTo(StockpileShape.deckTop);
  });
});
