import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WATER_CONFIG, WaterLayer, encodeWaterDepth } from '../src/render/WaterLayer';
import { GameMap } from '../src/sim/GameMap';

/** A 4 x 4 map whose corner height is 2 - cx: land on the left, sea deepening to the right. */
function slopeMap(): GameMap {
  const heights = Float32Array.from({ length: 25 }, (_, i) => 2 - (i % 5) * 2);
  return new GameMap(4, 4, 1, heights, new Uint8Array(16));
}

describe('encodeWaterDepth', () => {
  it('stores one byte per corner, deeper water brighter', () => {
    const data = encodeWaterDepth(slopeMap());
    expect(data).toHaveLength(25);
    for (let cx = 1; cx < 5; cx++) expect(data[cx]).toBeGreaterThan(data[cx - 1]);
  });

  it('clamps land and the deep sea to the ends of the range', () => {
    const data = encodeWaterDepth(slopeMap());
    expect(data[0]).toBe(0); // 2 above the sea
    expect(data[4]).toBe(255); // 6 below it
  });

  it('puts the shoreline at the encoded sea level', () => {
    const heights = new Float32Array(25); // every corner exactly at sea level
    const data = encodeWaterDepth(new GameMap(4, 4, 1, heights, new Uint8Array(16)));
    const shore = (-WATER_CONFIG.landDepth / (WATER_CONFIG.maxDepth - WATER_CONFIG.landDepth)) * 255;
    expect(data[12]).toBeCloseTo(shore, -0.5);
  });
});

describe('WaterLayer', () => {
  it('covers the map and an open sea out to the horizon around it, at sea level, with one mesh', () => {
    const layer = new WaterLayer(slopeMap());
    const meshes = layer.object.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh);
    expect(meshes).toHaveLength(1);
    const box = new THREE.Box3().setFromObject(layer.object);
    const m = WATER_CONFIG.openSeaMargin;
    expect(m).toBeGreaterThan(500);
    expect(box.min.x).toBeCloseTo(-m);
    expect(box.min.z).toBeCloseTo(-m);
    expect(box.max.x).toBeCloseTo(4 + m);
    expect(box.max.z).toBeCloseTo(4 + m);
    expect(box.max.y).toBeCloseTo(0);
    layer.dispose();
  });

  it('moves its waves along with time and frees everything on dispose', () => {
    const layer = new WaterLayer(slopeMap());
    layer.advance(0.05);
    layer.advance(0.03);
    expect(layer.time).toBeCloseTo(0.08);
    layer.advance(5); // a stalled tab: the waves move one capped step, not five seconds
    expect(layer.time).toBeCloseTo(0.08 + WATER_CONFIG.maxStep);
    layer.dispose();
    expect(layer.object.children).toHaveLength(0);
  });
});
