// Low-poly peasant shapes: a figure (legs, tunic, head, hat) in vertex colours, and the bundle a carrier has on its back.
import * as THREE from 'three';

/** A box of the figure: its size, the height of its bottom and its sRGB colour. */
interface FigurePart {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly bottom: number;
  readonly color: number;
}

/** Bottom to top; the figure faces +z and is 0.8 tall. A light tunic and straw hat stand out against grass. */
const FIGURE_PARTS: readonly FigurePart[] = [
  { width: 0.2, height: 0.28, depth: 0.12, bottom: 0, color: 0x5a4632 }, // legs
  { width: 0.32, height: 0.3, depth: 0.2, bottom: 0.28, color: 0xeadfc0 }, // tunic
  { width: 0.16, height: 0.16, depth: 0.16, bottom: 0.58, color: 0xe0b48c }, // head
  { width: 0.22, height: 0.06, depth: 0.22, bottom: 0.74, color: 0xc89b3c }, // hat
];
/** The carried bundle, on the tunic's back (-z). */
const BUNDLE_SIZE = new THREE.Vector3(0.22, 0.24, 0.14);
const BUNDLE_CENTRE = new THREE.Vector3(0, 0.48, -0.17);

export class PeasantGeometryFactory {
  /**
   * Builds the peasant figure: feet at y = 0, facing +z, 48 triangles, non-indexed with `position`, flat `normal` and
   * `color` attributes. Call once per layer; the caller owns and disposes the result.
   */
  public create(): THREE.BufferGeometry {
    const boxes = FIGURE_PARTS.map((part) =>
      new THREE.BoxGeometry(part.width, part.height, part.depth)
        .translate(0, part.bottom + part.height / 2, 0)
        .toNonIndexed(),
    );
    const total = boxes.reduce((sum, box) => sum + box.getAttribute('position').count, 0);
    const positions = new Float32Array(total * 3);
    const normals = new Float32Array(total * 3);
    const colors = new Float32Array(total * 3);
    const color = new THREE.Color();
    let offset = 0;
    boxes.forEach((box, i) => {
      const position = box.getAttribute('position');
      positions.set(position.array as Float32Array, offset * 3);
      normals.set(box.getAttribute('normal').array as Float32Array, offset * 3);
      color.set(FIGURE_PARTS[i].color);
      for (let v = 0; v < position.count; v++) color.toArray(colors, (offset + v) * 3);
      offset += position.count;
      box.dispose();
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  /** Builds the bundle a carrier has on its back, in the figure's space; coloured per instance. The caller disposes it. */
  public createBundle(): THREE.BufferGeometry {
    return new THREE.BoxGeometry(BUNDLE_SIZE.x, BUNDLE_SIZE.y, BUNDLE_SIZE.z).translate(
      BUNDLE_CENTRE.x,
      BUNDLE_CENTRE.y,
      BUNDLE_CENTRE.z,
    );
  }
}
