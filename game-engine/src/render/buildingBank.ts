// The earth bank round a building: a sloped ring from the floor's edge down to the ground a little way out, so a
// building on a slope meets the terrain smoothly instead of showing a tall bare foundation. Render only.
import * as THREE from 'three';
import type { GameMap } from '../sim/GameMap';
import { OBJECT_KINDS, type ObjectKind } from '../sim/ObjectKind';
import { terrainCornerColor } from './terrainCornerColor';

/** Bank tuning in world units. Frozen; tune by editing the values here. */
export const BANK_CONFIG = Object.freeze({
  /** How far the bank reaches out from the footprint. */
  width: 0.7,
  /** How far the outer edge is sunk below the ground, so it never floats over the terrain's triangles. */
  sink: 0.06,
  /** How far the inner edge sits below the floor, against z-fighting with floors and foundations. */
  innerDrop: 0.02,
  /** Brightness of the inner edge against the ground colour: the packed earth darkens toward the building. */
  innerShade: 0.78,
});

/** A point of the bank in the building's frame (x, z from the footprint's corner) and whether it is on the inner edge. */
interface BankPoint {
  readonly x: number;
  readonly z: number;
  readonly inner: boolean;
}

/**
 * The bank's triangles round a building of `kind` at tile (tx, ty) whose floor is at height `floor`, in the
 * building's frame (origin at (tx, floor, ty)); non-indexed, a position and a colour per vertex, every face turned up.
 * Call once per building when its mesh is made.
 */
export function bankGeometry(map: GameMap, kind: ObjectKind, tx: number, ty: number, floor: number): THREE.BufferGeometry {
  const { width: w, height: h } = OBJECT_KINDS[kind];
  const out = BANK_CONFIG.width;
  const triangles: BankPoint[][] = [];
  const quad = (a: BankPoint, b: BankPoint, c: BankPoint, d: BankPoint): void => {
    triangles.push([a, b, c], [a, c, d]);
  };
  const inner = (x: number, z: number): BankPoint => ({ x, z, inner: true });
  const outer = (x: number, z: number): BankPoint => ({ x, z, inner: false });
  for (let i = 0; i < w; i++) {
    quad(inner(i, 0), inner(i + 1, 0), outer(i + 1, -out), outer(i, -out));
    quad(inner(i, h), inner(i + 1, h), outer(i + 1, h + out), outer(i, h + out));
  }
  for (let j = 0; j < h; j++) {
    quad(inner(0, j), inner(0, j + 1), outer(-out, j + 1), outer(-out, j));
    quad(inner(w, j), inner(w, j + 1), outer(w + out, j + 1), outer(w + out, j));
  }
  for (const [cx, cz, sx, sz] of [[0, 0, -1, -1], [w, 0, 1, -1], [0, h, -1, 1], [w, h, 1, 1]]) {
    quad(inner(cx, cz), outer(cx + sx * out, cz), outer(cx + sx * out, cz + sz * out), outer(cx, cz + sz * out));
  }
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();
  const scratch = new THREE.Color();
  for (const triangle of triangles) {
    const points = triangle.map((p) => new THREE.Vector3(p.x, heightOf(map, p, tx, ty, floor), p.z));
    const [a, b, c] = points;
    const up = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).y >= 0;
    const order = up ? [0, 1, 2] : [0, 2, 1];
    for (const k of order) {
      positions.push(points[k].x, points[k].y, points[k].z);
      groundColor(map, tx + triangle[k].x, ty + triangle[k].z, color, scratch);
      if (triangle[k].inner) color.multiplyScalar(BANK_CONFIG.innerShade);
      colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** The bank of `bankGeometry` as a flat-shaded, vertex-coloured mesh. The caller owns and disposes it. */
export function bankMesh(map: GameMap, kind: ObjectKind, tx: number, ty: number, floor: number): THREE.Mesh {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  return new THREE.Mesh(bankGeometry(map, kind, tx, ty, floor), material);
}

/** Height of bank point `p` in the building's frame: just under the floor inside, sunk into the ground outside. */
function heightOf(map: GameMap, p: BankPoint, tx: number, ty: number, floor: number): number {
  const top = -BANK_CONFIG.innerDrop;
  if (p.inner) return top;
  return Math.min(top, groundHeight(map, tx + p.x, ty + p.z) - BANK_CONFIG.sink - floor);
}

/** Bilinear height of the map's corner grid at world (x, z), clamped to the map. */
function groundHeight(map: GameMap, x: number, z: number): number {
  const cx = Math.min(map.width - 1, Math.max(0, Math.floor(x)));
  const cy = Math.min(map.height - 1, Math.max(0, Math.floor(z)));
  const fx = Math.min(1, Math.max(0, x - cx));
  const fz = Math.min(1, Math.max(0, z - cy));
  const top = map.heightAt(cx, cy) * (1 - fx) + map.heightAt(cx + 1, cy) * fx;
  const bottom = map.heightAt(cx, cy + 1) * (1 - fx) + map.heightAt(cx + 1, cy + 1) * fx;
  return top * (1 - fz) + bottom * fz;
}

/** The terrain's colour at the map corner nearest world (x, z), as the tile there paints it; written into `out`. */
function groundColor(map: GameMap, x: number, z: number, out: THREE.Color, scratch: THREE.Color): THREE.Color {
  const cx = Math.min(map.width, Math.max(0, Math.round(x)));
  const cy = Math.min(map.height, Math.max(0, Math.round(z)));
  const type = map.tileAt(Math.min(map.width - 1, cx), Math.min(map.height - 1, cy))!;
  return terrainCornerColor(map, type, cx, cy, out, scratch);
}
