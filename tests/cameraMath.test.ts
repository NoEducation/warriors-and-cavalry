import { describe, expect, it } from 'vitest';
import { clampDt, orbitOffset, panDelta, zoomDistance } from '../src/render/cameraMath';

const DEG = Math.PI / 180;

describe('clampDt', () => {
  it('keeps normal frame times', () => {
    expect(clampDt(0.016)).toBe(0.016);
  });

  it('caps long frames at maxDt', () => {
    expect(clampDt(5)).toBe(0.1);
  });

  it('turns negative and NaN into 0', () => {
    expect(clampDt(-1)).toBe(0);
    expect(clampDt(NaN)).toBe(0);
  });
});

describe('panDelta', () => {
  it('moves forward along -z at yaw 0', () => {
    const d = panDelta(1, 0, 0, 10, 0.5);
    expect(d.dx).toBeCloseTo(0);
    expect(d.dz).toBeCloseTo(-5);
  });

  it('moves right along +x at yaw 0', () => {
    const d = panDelta(0, 1, 0, 10, 0.5);
    expect(d.dx).toBeCloseTo(5);
    expect(d.dz).toBeCloseTo(0);
  });

  it('normalises diagonal movement', () => {
    const d = panDelta(1, 1, 0, 10, 1);
    expect(Math.hypot(d.dx, d.dz)).toBeCloseTo(10);
  });

  it('rotates with yaw', () => {
    const a = panDelta(1, 0, 0, 10, 1);
    const b = panDelta(1, 0, Math.PI / 2, 10, 1);
    expect(Math.hypot(b.dx, b.dz)).toBeCloseTo(10);
    expect(a.dx * b.dx + a.dz * b.dz).toBeCloseTo(0);
  });

  it('does not move without input', () => {
    const d = panDelta(0, 0, 1, 10, 1);
    expect(d.dx).toBeCloseTo(0);
    expect(d.dz).toBeCloseTo(0);
  });
});

describe('zoomDistance', () => {
  it('zooms out for positive delta and in for negative', () => {
    expect(zoomDistance(60, 100)).toBeCloseTo(66);
    expect(zoomDistance(60, -100)).toBeCloseTo(54.545, 3);
  });

  it('clamps to the distance limits', () => {
    expect(zoomDistance(159, 100)).toBe(160);
    expect(zoomDistance(21, -100)).toBe(20);
  });

  it('leaves distance unchanged for zero delta', () => {
    expect(zoomDistance(60, 0)).toBe(60);
  });
});

describe('orbitOffset', () => {
  it('places the camera above the +z side at yaw 0', () => {
    const o = orbitOffset(0, 55 * DEG, 60);
    expect(o.x).toBeCloseTo(0);
    expect(o.y).toBeCloseTo(60 * Math.sin(55 * DEG));
    expect(o.z).toBeCloseTo(60 * Math.cos(55 * DEG));
  });

  it('keeps the requested distance at any yaw', () => {
    const o = orbitOffset(1.3, 55 * DEG, 60);
    expect(Math.hypot(o.x, o.y, o.z)).toBeCloseTo(60);
  });
});
