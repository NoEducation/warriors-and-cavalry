// Low-poly peasant part shapes in vertex colours, one geometry per part, each with its joint at the origin.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { type PartPiece, PEASANT_PART_PIECES, type PeasantPart } from './peasantParts';

export class PeasantGeometryFactory {
  /**
   * Builds the geometry of `part` from its boxes: non-indexed with `position`, flat `normal` and `color` attributes,
   * its joint at the origin, facing +z. Call once per part per layer; the caller owns and disposes the result.
   */
  public create(part: PeasantPart): THREE.BufferGeometry {
    const boxes = PEASANT_PART_PIECES[part].map((piece) => this.box(piece));
    const geometry = mergeGeometries(boxes);
    for (const box of boxes) box.dispose();
    if (!geometry) throw new Error(`peasant part ${part} could not be merged`);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  /** One box of a part, its top face scaled by the piece's taper, painted in the piece's colour. */
  private box(piece: PartPiece): THREE.BufferGeometry {
    const height = piece.y1 - piece.y0;
    const box = new THREE.BoxGeometry(piece.w, height, piece.d).toNonIndexed();
    const position = box.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      if (position.getY(i) <= 0) continue;
      position.setX(i, position.getX(i) * piece.taper);
      position.setZ(i, position.getZ(i) * piece.taper);
    }
    box.translate(piece.cx, piece.y0 + height / 2, piece.cz);
    box.deleteAttribute('uv');
    box.computeVertexNormals(); // flat per face: the geometry is non-indexed
    const rgb = new THREE.Color(piece.color);
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) rgb.toArray(colors, i * 3);
    box.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return box;
  }
}
