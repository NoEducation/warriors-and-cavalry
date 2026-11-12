// Low-poly tree shapes, one merged geometry per species with trunk and crown colours baked into vertex colours.
import * as THREE from 'three';
import { TREE_SPECIES, TreeSpecies } from './TreeSpecies';

/** A primitive of a tree, in tree space (base at the origin), and its sRGB colour. */
interface TreePart {
  readonly geometry: THREE.BufferGeometry;
  readonly color: number;
}

/** Radial segments of trunks and branches; caps are left off, as they are underground or hidden in the crown. */
const TRUNK_SEGMENTS = 5;
const CONE_SEGMENTS = 7;
const BRANCH_SEGMENTS = 4;

export class TreeGeometryFactory {
  /**
   * Builds the shape of `species` at scale 1: base at y = 0, as tall as the species' base height, with `position`,
   * `normal` (flat, per face) and `color` attributes. Call once per species; the caller owns and disposes the result.
   */
  public create(species: TreeSpecies): THREE.BufferGeometry {
    const geometry = this.merge(this.parts(species));
    // Normalise to the exact base height, so the shapes below only need to be right in proportion.
    geometry.computeBoundingBox();
    geometry.scale(1, TREE_SPECIES[species].height / geometry.boundingBox!.max.y, 1);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  private parts(species: TreeSpecies): TreePart[] {
    const { trunkColor: trunk, crownColor: crown } = TREE_SPECIES[species];
    switch (species) {
      case TreeSpecies.Pine:
        return [
          { geometry: this.trunk(0.07, 0.1, 0.55), color: trunk },
          { geometry: this.cone(0.55, 0.8, 0.35, 0), color: crown },
          { geometry: this.cone(0.42, 0.7, 0.75, 0.3), color: crown },
          { geometry: this.cone(0.28, 0.6, 1.3, 0.6), color: crown },
        ];
      case TreeSpecies.Oak:
        return [
          { geometry: this.trunk(0.1, 0.15, 0.62), color: trunk },
          { geometry: this.blob(0.5, 0, 1.04, 0), color: crown },
          { geometry: this.blob(0.4, 0.3, 0.86, 0.1), color: crown },
          { geometry: this.blob(0.4, -0.24, 0.9, -0.2), color: crown },
        ];
      case TreeSpecies.Birch:
        return [
          { geometry: this.trunk(0.045, 0.07, 1.3), color: trunk },
          { geometry: this.blob(0.38, 0, 1.45, 0), color: crown },
          { geometry: this.blob(0.28, 0.12, 1.18, 0.06), color: crown },
        ];
      case TreeSpecies.Dead:
        return [
          { geometry: this.trunk(0.04, 0.1, 1.3), color: trunk },
          { geometry: this.branch(0.42, 0.8, 0.9, 0), color: crown },
          { geometry: this.branch(0.34, 1.0, 0.8, 2.6), color: crown },
        ];
    }
  }

  /** Open tapered cylinder standing on the origin. */
  private trunk(topRadius: number, bottomRadius: number, height: number): THREE.BufferGeometry {
    const geometry = new THREE.CylinderGeometry(topRadius, bottomRadius, height, TRUNK_SEGMENTS, 1, true);
    return geometry.translate(0, height / 2, 0);
  }

  /** Open cone whose base sits at height `baseY`, turned by `turn` so stacked cones do not line up. */
  private cone(radius: number, height: number, baseY: number, turn: number): THREE.BufferGeometry {
    const geometry = new THREE.ConeGeometry(radius, height, CONE_SEGMENTS, 1, true);
    return geometry.rotateY(turn).translate(0, baseY + height / 2, 0);
  }

  /** Slightly flattened icosahedron centred at (x, y, z), a lump of foliage. */
  private blob(radius: number, x: number, y: number, z: number): THREE.BufferGeometry {
    return new THREE.IcosahedronGeometry(radius, 0).scale(1, 0.85, 1).rotateY(x + z).translate(x, y, z);
  }

  /** Thin open cylinder of `length` growing from the trunk at height `y`, tilted `tilt` from vertical towards `heading`. */
  private branch(length: number, y: number, tilt: number, heading: number): THREE.BufferGeometry {
    const geometry = new THREE.CylinderGeometry(0.022, 0.04, length, BRANCH_SEGMENTS, 1, true);
    return geometry.translate(0, length / 2, 0).rotateZ(-tilt).rotateY(heading).translate(0, y, 0);
  }

  /** Concatenates the parts into one non-indexed geometry with a per-vertex colour; disposes the parts. */
  private merge(parts: readonly TreePart[]): THREE.BufferGeometry {
    const flat = parts.map((p) => (p.geometry.index ? p.geometry.toNonIndexed() : p.geometry));
    const total = flat.reduce((sum, g) => sum + g.getAttribute('position').count, 0);
    const positions = new Float32Array(total * 3);
    const colors = new Float32Array(total * 3);
    const color = new THREE.Color();
    let offset = 0;
    flat.forEach((g, i) => {
      const position = g.getAttribute('position');
      positions.set(position.array as Float32Array, offset * 3);
      color.set(parts[i].color);
      for (let v = 0; v < position.count; v++) color.toArray(colors, (offset + v) * 3);
      offset += position.count;
    });
    for (const g of new Set([...parts.map((p) => p.geometry), ...flat])) g.dispose();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
  }
}
