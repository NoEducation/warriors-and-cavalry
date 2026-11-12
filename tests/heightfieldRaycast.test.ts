import { describe, expect, it } from 'vitest';
import { raycastHeightfield, type Vec3 } from '../src/render/heightfieldRaycast';
import { GameMap } from '../src/sim/GameMap';
import { MapGenerator } from '../src/sim/MapGenerator';
import { mulberry32 } from '../src/sim/rng';

const MAX = 1000;

function flatMap(size: number): GameMap {
  return new GameMap(size, size, 0, new Float32Array((size + 1) * (size + 1)), new Uint8Array(size * size));
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Möller–Trumbore, both faces; the ray parameter t of the hit or null. */
function intersect(o: Vec3, d: Vec3, a: Vec3, b: Vec3, c: Vec3): number | null {
  const e1 = sub(b, a);
  const e2 = sub(c, a);
  const p = cross(d, e2);
  const det = dot(e1, p);
  if (Math.abs(det) < 1e-12) return null;
  const s = sub(o, a);
  const u = dot(s, p) / det;
  if (u < 0 || u > 1) return null;
  const q = cross(s, e1);
  const v = dot(d, q) / det;
  if (v < 0 || u + v > 1) return null;
  const t = dot(e2, q) / det;
  return t >= 0 ? t : null;
}

/** Tests every triangle the terrain mesh draws and returns the tile of the nearest hit. */
function bruteForce(map: GameMap, o: Vec3, d: Vec3): { tx: number; ty: number } | null {
  let best: { tx: number; ty: number; t: number } | null = null;
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const a = { x: tx, y: map.heightAt(tx, ty), z: ty };
      const b = { x: tx + 1, y: map.heightAt(tx + 1, ty), z: ty };
      const c = { x: tx, y: map.heightAt(tx, ty + 1), z: ty + 1 };
      const dd = { x: tx + 1, y: map.heightAt(tx + 1, ty + 1), z: ty + 1 };
      for (const [p, q, r] of [
        [a, c, b],
        [b, c, dd],
      ]) {
        const t = intersect(o, d, p, q, r);
        if (t !== null && (!best || t < best.t)) best = { tx, ty, t };
      }
    }
  }
  return best && { tx: best.tx, ty: best.ty };
}

describe('raycastHeightfield', () => {
  const flat = flatMap(8);

  it('hits the tile straight below', () => {
    const hit = raycastHeightfield(flat, { x: 2.5, y: 10, z: 3.5 }, { x: 0, y: -1, z: 0 }, MAX);
    expect(hit).not.toBeNull();
    expect(hit?.tx).toBe(2);
    expect(hit?.ty).toBe(3);
    expect(hit?.point.y).toBeCloseTo(0);
    expect(hit?.point.x).toBeCloseTo(2.5);
    expect(hit?.point.z).toBeCloseTo(3.5);
  });

  it('follows a slanted ray', () => {
    const hit = raycastHeightfield(flat, { x: 0.5, y: 5, z: 0.5 }, { x: 1, y: -1, z: 1 }, MAX);
    expect(hit && { tx: hit.tx, ty: hit.ty }).toEqual({ tx: 5, ty: 5 });
  });

  it('enters the map from outside', () => {
    const hit = raycastHeightfield(flat, { x: -5, y: 5, z: 4.5 }, { x: 1, y: -0.5, z: 0 }, MAX);
    expect(hit && { tx: hit.tx, ty: hit.ty }).toEqual({ tx: 5, ty: 4 });
  });

  it('returns null when the ray lands outside the map', () => {
    expect(raycastHeightfield(flat, { x: 4, y: 5, z: 4 }, { x: 1, y: -0.1, z: 0 }, MAX)).toBeNull();
    expect(raycastHeightfield(flat, { x: -3, y: 5, z: 4 }, { x: 0, y: -1, z: 0 }, MAX)).toBeNull();
  });

  it('returns null when the hit is beyond maxDistance', () => {
    expect(raycastHeightfield(flat, { x: 2.5, y: 10, z: 3.5 }, { x: 0, y: -1, z: 0 }, 5)).toBeNull();
  });

  it('returns null for rays that cannot hit or are invalid', () => {
    expect(raycastHeightfield(flat, { x: 4, y: 50, z: 4 }, { x: 1, y: 0, z: 0 }, MAX)).toBeNull();
    expect(raycastHeightfield(flat, { x: 4, y: 5, z: 4 }, { x: 0, y: 1, z: 0 }, MAX)).toBeNull();
    expect(raycastHeightfield(flat, { x: 4, y: 5, z: 4 }, { x: 0, y: 0, z: 0 }, MAX)).toBeNull();
    expect(raycastHeightfield(flat, { x: 4, y: 5, z: 4 }, { x: NaN, y: -1, z: 0 }, MAX)).toBeNull();
    expect(raycastHeightfield(flat, { x: NaN, y: 5, z: 4 }, { x: 0, y: -1, z: 0 }, MAX)).toBeNull();
  });

  it('ignores triangles seen from below, as the renderer culls them', () => {
    expect(raycastHeightfield(flat, { x: 4.5, y: -5, z: 4.5 }, { x: 0, y: 1, z: 0 }, MAX)).toBeNull();
    expect(raycastHeightfield(flat, { x: -5, y: -1, z: 4.5 }, { x: 1, y: 0.1, z: 0 }, MAX)).toBeNull();
  });

  it('agrees with brute force on a generated map', () => {
    const { map } = new MapGenerator().generate({ seed: 1, width: 32, height: 32 });
    const rand = mulberry32(12345);
    let hits = 0;
    for (let i = 0; i < 300; i++) {
      const origin = { x: rand() * 40 - 4, y: 10 + rand() * 15, z: rand() * 40 - 4 };
      const direction = { x: rand() * 2 - 1, y: -(0.6 + rand() * 1.4), z: rand() * 2 - 1 };
      const expected = bruteForce(map, origin, direction);
      const hit = raycastHeightfield(map, origin, direction, MAX);
      expect(hit && { tx: hit.tx, ty: hit.ty }, `ray ${i}`).toEqual(expected);
      if (expected) hits++;
    }
    expect(hits).toBeGreaterThan(100);
  });
});
