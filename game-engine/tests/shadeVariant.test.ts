import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { shadeVariant } from '../src/render/buildings/shadeVariant';

const STONE = 0x9a9a94;

describe('shadeVariant', () => {
  it('gives the same shade for the same salt and index', () => {
    expect(shadeVariant(STONE, 0x11, 4)).toBe(shadeVariant(STONE, 0x11, 4));
  });

  it('varies the shade across indices', () => {
    const shades = new Set<number>();
    for (let i = 0; i < 50; i++) shades.add(shadeVariant(STONE, 0x11, i));
    expect(shades.size).toBeGreaterThanOrEqual(3);
  });

  it('keeps every shade within 8% of the base brightness', () => {
    const base = new THREE.Color(STONE);
    for (let i = 0; i < 50; i++) {
      const shade = new THREE.Color(shadeVariant(STONE, 0x11, i));
      for (const k of ['r', 'g', 'b'] as const) {
        expect(shade[k] / base[k]).toBeGreaterThan(0.92);
        expect(shade[k] / base[k]).toBeLessThan(1.08);
      }
    }
  });
});
