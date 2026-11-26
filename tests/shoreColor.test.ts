import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SHORE_LOOK_CONFIG, sandColor, seabedColor } from '../src/render/shoreColor';
import { GameMap } from '../src/sim/GameMap';

function flat(height: number, size = 40): GameMap {
  return new GameMap(size, size, 5, new Float32Array((size + 1) * (size + 1)).fill(height), new Uint8Array(size * size));
}

function brightness(c: THREE.Color): number {
  return c.r + c.g + c.b;
}

describe('sandColor', () => {
  it('is darker at the waterline than on the dry beach', () => {
    const wet = sandColor(flat(0.01), 10, 10, new THREE.Color());
    const dry = sandColor(flat(0.4), 10, 10, new THREE.Color());
    expect(brightness(wet)).toBeLessThan(brightness(dry));
  });

  it('draws a darker tide line just above the wet sand', () => {
    const tide = sandColor(flat(SHORE_LOOK_CONFIG.wetBand + SHORE_LOOK_CONFIG.tideBand / 2), 10, 10, new THREE.Color());
    const dry = sandColor(flat(0.4), 10, 10, new THREE.Color());
    expect(brightness(tide)).toBeLessThan(brightness(dry));
  });

  it('scatters a few pebbles over the beach', () => {
    const map = flat(0.4);
    const values = [];
    for (let cy = 0; cy <= 40; cy++) for (let cx = 0; cx <= 40; cx++) values.push(brightness(sandColor(map, cx, cy, new THREE.Color())));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const dark = values.filter((v) => v < mean * 0.85).length / values.length;
    expect(dark).toBeGreaterThan(0.02);
    expect(dark).toBeLessThan(0.15);
  });
});

describe('seabedColor', () => {
  it('is light sand in the shallows and darker offshore', () => {
    const shallow = seabedColor(flat(-0.2), 10, 10, new THREE.Color());
    const deep = seabedColor(flat(-5), 10, 10, new THREE.Color());
    expect(brightness(deep)).toBeLessThan(brightness(shallow) * 0.6);
  });
});
