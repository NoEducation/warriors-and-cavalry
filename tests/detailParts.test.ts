import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  addArrowSlit,
  addChimney,
  addDoor,
  addPlinth,
  addTimberFrame,
  addWindow,
  type FaceSpot,
  type WallFace,
} from '../src/render/buildings/detailParts';
import { ShapeBuilder } from '../src/render/buildings/ShapeBuilder';
import type { BoxSpec } from '../src/render/buildings/shapeParts';

const WALL: BoxSpec = { x0: 0.4, z0: 0.4, x1: 1.6, z1: 1.6, y0: 0, y1: 0.9 };
const FACES: readonly WallFace[] = ['south', 'north', 'east', 'west'];
const SLACK = 0.06;

function bounds(fill: (shape: ShapeBuilder) => void): THREE.Box3 {
  const shape = new ShapeBuilder();
  fill(shape);
  return new THREE.Box3().setFromObject(shape.build());
}

function spot(face: WallFace): FaceSpot {
  return { wall: WALL, face, along: 1, bottom: 0.1, width: 0.3, height: 0.5 };
}

function expectNearWall(box: THREE.Box3): void {
  expect(box.min.x).toBeGreaterThanOrEqual(WALL.x0 - SLACK);
  expect(box.min.z).toBeGreaterThanOrEqual(WALL.z0 - SLACK);
  expect(box.max.x).toBeLessThanOrEqual(WALL.x1 + SLACK);
  expect(box.max.z).toBeLessThanOrEqual(WALL.z1 + SLACK);
  expect(box.min.y).toBeGreaterThanOrEqual(WALL.y0 - 1e-6);
  expect(box.max.y).toBeLessThanOrEqual(WALL.y1 + SLACK);
}

describe('detailParts', () => {
  for (const [name, add] of [
    ['door', addDoor],
    ['window', addWindow],
    ['arrow slit', addArrowSlit],
  ] as const) {
    it(`keeps a ${name} on every face within a hair of the wall`, () => {
      for (const face of FACES) expectNearWall(bounds((s) => add(s, spot(face))));
    });

    it(`stands a ${name} on the south face proud of the wall's front`, () => {
      const box = bounds((s) => add(s, spot('south')));
      expect(box.max.z).toBeGreaterThan(WALL.z1);
      expect(box.min.z).toBeGreaterThanOrEqual(WALL.z1 - 1e-6);
    });
  }

  it('keeps timber framing and the plinth within a hair of the wall', () => {
    expectNearWall(bounds((s) => addTimberFrame(s, WALL, 0.08)));
    expectNearWall(bounds((s) => addPlinth(s, WALL, 0.15, 0.04)));
  });

  it('builds a chimney in the column it is given', () => {
    const box = bounds((s) => addChimney(s, 1, 1, 0.2, 0.5, 1.6));
    expect(box.min.y).toBeCloseTo(0.5);
    expect(box.max.y).toBeGreaterThanOrEqual(1.6);
    expect(box.min.x).toBeGreaterThanOrEqual(1 - 0.06);
    expect(box.max.x).toBeLessThanOrEqual(1.2 + 0.06);
  });
});
