// The Hovel: a small house with a pyramid thatch roof.
import * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { ShapeBuilder } from './ShapeBuilder';
import { SHAPE_COLORS } from './shapeParts';

export class HovelShape implements BuildingShape {
  /** Creates a new Hovel model (see `BuildingShape.build`). */
  public build(): THREE.Mesh {
    const { width: w, height: d } = OBJECT_KINDS[ObjectKind.Hovel];
    const shape = new ShapeBuilder().addFoundation(w, d);
    const inset = 0.4;
    shape.addBox({ x0: inset, z0: inset, x1: w - inset, z1: d - inset, y0: 0, y1: 0.9 }, SHAPE_COLORS.timber);
    const roofWidth = w - 2 * 0.25;
    const roof = new THREE.ConeGeometry(roofWidth / Math.SQRT2, 0.8, 4);
    roof.rotateY(Math.PI / 4); // edges parallel to the walls
    roof.translate(w / 2, 0.9 + 0.4, d / 2);
    shape.add(roof, SHAPE_COLORS.straw);
    return shape.build();
  }
}
