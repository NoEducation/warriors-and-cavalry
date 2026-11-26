import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PeasantGeometryFactory } from '../src/render/PeasantGeometryFactory';
import { PEASANT_JOINTS, PeasantPart } from '../src/render/peasantParts';

const factory = new PeasantGeometryFactory();

function boxOf(part: PeasantPart): THREE.Box3 {
  const geometry = factory.create(part);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!.clone();
  geometry.dispose();
  return box;
}

describe('PeasantGeometryFactory', () => {
  it('builds every part non-indexed, with a normal and a colour per vertex, under 80 triangles', () => {
    for (const part of Object.values(PeasantPart)) {
      const geometry = factory.create(part);
      const count = geometry.getAttribute('position').count;
      expect(geometry.index, `part ${part}`).toBeNull();
      expect(count / 3, `part ${part}`).toBeLessThan(80);
      expect(geometry.getAttribute('normal').count).toBe(count);
      expect(geometry.getAttribute('color').count).toBe(count);
      geometry.dispose();
    }
  });

  it('hangs legs and arms down from their joints at the origin', () => {
    const leg = boxOf(PeasantPart.Leg);
    expect(leg.max.y).toBeCloseTo(0);
    expect(leg.min.y).toBeCloseTo(-0.3);
    expect(PEASANT_JOINTS.hip + leg.min.y).toBeCloseTo(0); // feet on the ground
    const arm = boxOf(PeasantPart.Arm);
    expect(arm.max.y).toBeCloseTo(0);
    expect(arm.min.y).toBeLessThan(PEASANT_JOINTS.hand + 0.02);
  });

  it('builds the torso up from the waist to the neck and keeps the figure under 0.9 tall', () => {
    const torso = boxOf(PeasantPart.Torso);
    expect(torso.min.y).toBeGreaterThan(-0.1);
    expect(torso.min.y).toBeLessThanOrEqual(0);
    expect(PEASANT_JOINTS.waist + torso.max.y).toBeCloseTo(PEASANT_JOINTS.neck);
    const head = boxOf(PeasantPart.Head);
    expect(head.min.y).toBeGreaterThanOrEqual(0);
    for (const headwear of [PeasantPart.Hat, PeasantPart.Hood]) {
      expect(PEASANT_JOINTS.neck + boxOf(headwear).max.y).toBeLessThan(0.9);
    }
    expect(PEASANT_JOINTS.neck + head.max.y).toBeGreaterThan(0.72);
  });

  it('paints the tunic and the headwear white, so the instance colour shows through', () => {
    for (const part of [PeasantPart.Torso, PeasantPart.Hat, PeasantPart.Hood]) {
      const geometry = factory.create(part);
      const colors = geometry.getAttribute('color');
      let white = 0;
      for (let i = 0; i < colors.count; i++) if (colors.getX(i) === 1 && colors.getY(i) === 1 && colors.getZ(i) === 1) white++;
      expect(white / colors.count, `part ${part}`).toBeGreaterThan(0.5);
      geometry.dispose();
    }
  });

  it('puts load bundles on the back and tools forward of the hand', () => {
    for (const part of [PeasantPart.LogBundle, PeasantPart.StoneBundle, PeasantPart.SackBundle]) {
      expect(boxOf(part).max.z, `part ${part}`).toBeLessThan(0.05);
    }
    for (const part of [PeasantPart.Axe, PeasantPart.Pick, PeasantPart.Hoe]) {
      const box = boxOf(part);
      expect(box.max.z, `part ${part}`).toBeGreaterThan(0.25);
      expect(box.min.y, `part ${part}`).toBeLessThan(PEASANT_JOINTS.hand + 0.05);
    }
  });
});
