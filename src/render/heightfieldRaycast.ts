// Ray picking against a GameMap's heightfield by walking the tiles under the ray (no three.js, tested in Node).
import type { GameMap } from '../sim/GameMap';

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface HeightfieldHit {
  readonly tx: number;
  readonly ty: number;
  readonly point: Vec3;
}

/** A ray with a unit-length direction. */
interface Ray {
  readonly origin: Vec3;
  readonly dir: Vec3;
}

/** Range of the ray parameter t. */
interface Span {
  readonly start: number;
  readonly end: number;
}

/** Tolerance for points on a triangle's edge, so rays through shared edges never slip between triangles. */
const EDGE_EPS = 1e-7;
/** Distance along the ray within which a hit counts as lying on the tile's exit edge; well below EDGE_EPS. */
const TIE_EPS = 1e-9;

/**
 * First point where the ray from `origin` along `direction` hits the terrain of `map` within `maxDistance`,
 * or null. Tests the same two triangles per tile that `TerrainMeshBuilder` draws, walking only the tiles the
 * ray's ground projection crosses, nearest first. Returns null for a zero or non-finite direction.
 */
export function raycastHeightfield(
  map: GameMap,
  origin: Vec3,
  direction: Vec3,
  maxDistance: number,
): HeightfieldHit | null {
  const len = Math.hypot(direction.x, direction.y, direction.z);
  if (!(len > 0) || !Number.isFinite(len) || !(maxDistance >= 0)) return null;
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y) || !Number.isFinite(origin.z)) return null;
  const dir = { x: direction.x / len, y: direction.y / len, z: direction.z / len };
  const ray: Ray = { origin, dir };

  const spanX = clipAxis(origin.x, dir.x, map.width, { start: 0, end: maxDistance });
  const span = spanX && clipAxis(origin.z, dir.z, map.height, spanX);
  if (!span) return null;

  // Grid traversal (Amanatides & Woo) over tiles in x/z, starting where the ray enters the map.
  let tx = Math.min(map.width - 1, Math.max(0, Math.floor(origin.x + dir.x * span.start)));
  let ty = Math.min(map.height - 1, Math.max(0, Math.floor(origin.z + dir.z * span.start)));
  const stepX = dir.x > 0 ? 1 : -1;
  const stepY = dir.z > 0 ? 1 : -1;
  const deltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const deltaY = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
  let nextX = dir.x !== 0 ? (tx + (dir.x > 0 ? 1 : 0) - origin.x) / dir.x : Infinity;
  let nextY = dir.z !== 0 ? (ty + (dir.z > 0 ? 1 : 0) - origin.z) / dir.z : Infinity;

  while (map.inBounds(tx, ty)) {
    const t = intersectTile(map, tx, ty, ray);
    const exit = Math.min(nextX, nextY);
    // A hit on the edge the ray leaves through belongs to the next tile (unless the ray leaves the map there).
    if (t <= span.end && (t < exit - TIE_EPS || exit > span.end)) {
      return { tx, ty, point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t } };
    }
    if (exit > span.end) return null;
    if (nextX < nextY) {
      tx += stepX;
      nextX += deltaX;
    } else {
      ty += stepY;
      nextY += deltaY;
    }
  }
  return null;
}

/** Narrows `span` to where the ray's coordinate `o + d * t` lies within [0, size]; null when it never does. */
function clipAxis(o: number, d: number, size: number, span: Span): Span | null {
  if (d === 0) return o >= 0 && o <= size ? span : null;
  const t0 = (0 - o) / d;
  const t1 = (size - o) / d;
  const start = Math.max(span.start, Math.min(t0, t1));
  const end = Math.min(span.end, Math.max(t0, t1));
  return start <= end ? { start, end } : null;
}

/**
 * Ray parameter of the nearest hit on tile (tx, ty), or Infinity. The tile is split along the diagonal from
 * corner (tx+1, ty) to (tx, ty+1), as in `TerrainMeshBuilder`.
 */
function intersectTile(map: GameMap, tx: number, ty: number, ray: Ray): number {
  const h00 = map.heightAt(tx, ty);
  const h10 = map.heightAt(tx + 1, ty);
  const h01 = map.heightAt(tx, ty + 1);
  const h11 = map.heightAt(tx + 1, ty + 1);
  // Triangle (tx,ty)-(tx,ty+1)-(tx+1,ty): y = h00 + (h10-h00)u + (h01-h00)v over u, v >= 0, u + v <= 1.
  const t1 = planeHit(ray, tx, ty, h00, h10 - h00, h01 - h00, false);
  // Triangle (tx+1,ty)-(tx,ty+1)-(tx+1,ty+1): through h11 at (1, 1) over u, v <= 1, u + v >= 1.
  const b = h11 - h01;
  const c = h11 - h10;
  const t2 = planeHit(ray, tx, ty, h11 - b - c, b, c, true);
  return Math.min(t1, t2);
}

/**
 * Ray parameter (>= 0) where the ray meets the plane y = a + b*u + c*v (u = x - tx, v = z - ty) inside the
 * lower-left (`upper` false) or upper-right (`upper` true) half of the unit tile; Infinity when it does not.
 */
function planeHit(ray: Ray, tx: number, ty: number, a: number, b: number, c: number, upper: boolean): number {
  const { origin: o, dir: d } = ray;
  const ou = o.x - tx;
  const ov = o.z - ty;
  const denom = d.y - b * d.x - c * d.z;
  if (denom === 0) return Infinity;
  const t = (a + b * ou + c * ov - o.y) / denom;
  if (!(t >= 0)) return Infinity;
  const u = ou + d.x * t;
  const v = ov + d.z * t;
  const inside = upper
    ? u <= 1 + EDGE_EPS && v <= 1 + EDGE_EPS && u + v >= 1 - EDGE_EPS
    : u >= -EDGE_EPS && v >= -EDGE_EPS && u + v <= 1 + EDGE_EPS;
  return inside ? t : Infinity;
}
