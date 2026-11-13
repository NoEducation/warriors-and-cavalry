// Collects the coloured parts of one building and merges them into a single mesh, so each building is one draw call.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  type BoxSpec,
  boxGeometry,
  FOOTPRINT_MARGIN,
  FOUNDATION_DEPTH,
  FOUNDATION_LIFT,
  SHAPE_COLORS,
} from './shapeParts';

/** The attributes every part keeps; merging needs the same set on every part. */
const KEPT_ATTRIBUTES: readonly string[] = ['position', 'normal'];

export class ShapeBuilder {
  private readonly parts: THREE.BufferGeometry[] = [];

  /** Adds `geometry` painted in `color`; the builder takes it over and may dispose it. Returns this builder. */
  public add(geometry: THREE.BufferGeometry, color: number): this {
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    if (part !== geometry) geometry.dispose();
    for (const name of Object.keys(part.attributes)) {
      if (!KEPT_ATTRIBUTES.includes(name)) part.deleteAttribute(name);
    }
    part.clearGroups();
    const rgb = new THREE.Color(color);
    const colors = new Float32Array(part.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) rgb.toArray(colors, i);
    part.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.parts.push(part);
    return this;
  }

  /** Adds a box filling `spec`, painted in `color`. Returns this builder. */
  public addBox(spec: BoxSpec, color: number): this {
    return this.add(boxGeometry(spec), color);
  }

  /**
   * Adds the foundation of a `w` x `d` footprint: inset by `FOOTPRINT_MARGIN`, reaching `FOUNDATION_DEPTH` below the
   * floor and showing `lift` above it. Returns this builder.
   */
  public addFoundation(
    w: number,
    d: number,
    color: number = SHAPE_COLORS.foundation,
    lift: number = FOUNDATION_LIFT,
  ): this {
    const m = FOOTPRINT_MARGIN;
    return this.addBox({ x0: m, z0: m, x1: w - m, z1: d - m, y0: -FOUNDATION_DEPTH, y1: lift }, color);
  }

  /**
   * Merges the parts into one mesh with one flat-shaded material that takes its colours from the vertices. Frees the
   * parts and empties the builder. The caller owns the mesh and disposes it (`disposeObject`).
   */
  public build(): THREE.Mesh {
    const geometry = mergeGeometries(this.parts);
    for (const part of this.parts) part.dispose();
    this.parts.length = 0;
    if (!geometry) throw new Error('building parts could not be merged');
    return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  }
}
