// A plain stone block over a kind's footprint, for kinds whose own shape is not built yet.
import type * as THREE from 'three';
import { OBJECT_KINDS, type ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { ShapeBuilder } from './ShapeBuilder';
import { SHAPE_COLORS } from './shapeParts';

export class PlaceholderShape implements BuildingShape {
  /** A placeholder for buildings of `kind`, `blockHeight` tall. */
  public constructor(private readonly kind: ObjectKind, private readonly blockHeight: number) {}

  /** Creates a new placeholder model (see `BuildingShape.build`). */
  public build(): THREE.Mesh {
    const { width: w, height: d } = OBJECT_KINDS[this.kind];
    const shape = new ShapeBuilder().addFoundation(w, d);
    shape.addBox({ x0: 0, z0: 0, x1: w, z1: d, y0: 0, y1: this.blockHeight }, SHAPE_COLORS.stone);
    return shape.build();
  }
}
