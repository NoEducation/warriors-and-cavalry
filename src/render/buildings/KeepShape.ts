// The Keep: a stone hall with a taller tower on its lowest-coordinate corner.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { boxMesh, FOOTPRINT_MARGIN, groupWithFoundation, SHAPE_COLORS } from './shapeParts';

export class KeepShape implements BuildingShape {
  /** Creates a new Keep model (see `BuildingShape.build`). */
  public build(): THREE.Group {
    const { width: w, height: d } = OBJECT_KINDS[ObjectKind.Keep];
    const group = groupWithFoundation(w, d);
    const inset = 0.45;
    group.add(boxMesh({ x0: inset, z0: inset, x1: w - inset, z1: d - inset, y0: 0, y1: 2.2 }, SHAPE_COLORS.stone));
    const m = FOOTPRINT_MARGIN;
    const tower = 1.5;
    group.add(boxMesh({ x0: m, z0: m, x1: m + tower, z1: m + tower, y0: 0, y1: 3.8 }, SHAPE_COLORS.stone));
    return group;
  }
}
