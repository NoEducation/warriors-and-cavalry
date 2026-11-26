import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  addThatchRoof,
  gableRoofGeometry,
  leanToRoofGeometry,
  pyramidRoofGeometry,
} from '../src/render/buildings/roofParts';
import { ShapeBuilder } from '../src/render/buildings/ShapeBuilder';
import type { BoxSpec } from '../src/render/buildings/shapeParts';

const WALL: BoxSpec = { x0: 0.4, z0: 0.5, x1: 2.6, z1: 1.9, y0: 0, y1: 1 };
const RISE = 0.8;
const OVERHANG = 0.15;

function expectRoofBox(box: THREE.Box3): void {
  expect(box.min.x).toBeCloseTo(WALL.x0 - OVERHANG);
  expect(box.max.x).toBeCloseTo(WALL.x1 + OVERHANG);
  expect(box.min.z).toBeCloseTo(WALL.z0 - OVERHANG);
  expect(box.max.z).toBeCloseTo(WALL.z1 + OVERHANG);
  expect(box.min.y).toBeCloseTo(WALL.y1);
  expect(box.max.y).toBeCloseTo(WALL.y1 + RISE);
}

describe('roofParts', () => {
  it('rests a gable roof on the walls with its overhang', () => {
    const geometry = gableRoofGeometry(WALL, RISE, OVERHANG);
    geometry.computeBoundingBox();
    expectRoofBox(geometry.boundingBox as THREE.Box3);
  });

  it('rests a lean-to roof on the walls, high at the back', () => {
    const geometry = leanToRoofGeometry(WALL, RISE, OVERHANG);
    geometry.computeBoundingBox();
    expectRoofBox(geometry.boundingBox as THREE.Box3);
    const back = new THREE.Raycaster(new THREE.Vector3(1.5, 5, WALL.z0 + 0.05), new THREE.Vector3(0, -1, 0));
    const front = new THREE.Raycaster(new THREE.Vector3(1.5, 5, WALL.z1 - 0.05), new THREE.Vector3(0, -1, 0));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    expect(back.intersectObject(mesh)[0].point.y).toBeGreaterThan(front.intersectObject(mesh)[0].point.y);
  });

  it('rests a pyramid roof on the walls with its overhang', () => {
    const geometry = pyramidRoofGeometry(WALL, RISE, OVERHANG);
    geometry.computeBoundingBox();
    expectRoofBox(geometry.boundingBox as THREE.Box3);
  });

  it('layers a thatch roof over the gable shape with a ridge cap on top', () => {
    const shape = new ShapeBuilder();
    addThatchRoof(shape, WALL, RISE, OVERHANG, 0xc9b458);
    const box = new THREE.Box3().setFromObject(shape.build());
    expect(box.min.y).toBeCloseTo(WALL.y1);
    expect(box.max.y).toBeGreaterThan(WALL.y1 + RISE);
    expect(box.max.y).toBeLessThan(WALL.y1 + RISE + 0.2);
    expect(box.min.z).toBeCloseTo(WALL.z0 - OVERHANG);
  });
});
