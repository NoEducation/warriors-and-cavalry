import { describe, expect, it } from 'vitest';
import { PeasantGeometryFactory } from '../src/render/PeasantGeometryFactory';

describe('PeasantGeometryFactory', () => {
  it('builds a vertex-coloured figure under 60 triangles, about 0.8 tall, standing on y = 0', () => {
    const geometry = new PeasantGeometryFactory().create();
    expect(geometry.index).toBeNull();
    expect(geometry.getAttribute('position').count / 3).toBeLessThan(60);
    expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count);
    expect(geometry.getAttribute('normal')).toBeDefined();
    const box = geometry.boundingBox!;
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.y).toBeGreaterThan(0.7);
    expect(box.max.y).toBeLessThan(0.9);
    geometry.dispose();
  });

  it('builds a small bundle on the figure\'s back (behind it, -z)', () => {
    const bundle = new PeasantGeometryFactory().createBundle();
    bundle.computeBoundingBox();
    const box = bundle.boundingBox!;
    expect(box.max.z).toBeLessThan(0.05);
    expect(box.max.y - box.min.y).toBeLessThan(0.4);
    expect(box.min.y).toBeGreaterThan(0.3);
    bundle.dispose();
  });
});
