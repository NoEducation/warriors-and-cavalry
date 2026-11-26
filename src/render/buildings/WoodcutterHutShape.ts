// The Woodcutter's hut: a house with a gable roof running along x and a log pile beside it.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { ShapeBuilder } from './ShapeBuilder';
import { gableRoofGeometry } from './roofParts';
import { type BoxSpec, FOOTPRINT_MARGIN, SHAPE_COLORS } from './shapeParts';

export class WoodcutterHutShape implements BuildingShape {
  /** Creates a new Woodcutter's hut model (see `BuildingShape.build`). */
  public build(): THREE.Mesh {
    const { width: w, height: d } = OBJECT_KINDS[ObjectKind.WoodcutterHut];
    const shape = new ShapeBuilder().addFoundation(w, d);
    const walls: BoxSpec = { x0: 0.3, z0: 0.35, x1: w - 0.3, z1: d - 0.7, y0: 0, y1: 0.85 };
    shape.addBox(walls, SHAPE_COLORS.darkTimber);
    shape.add(gableRoofGeometry(walls, 0.7, 0.12), SHAPE_COLORS.hutRoof);
    const logPile: BoxSpec = { x0: 0.4, z0: d - 0.5, x1: w - 0.6, z1: d - FOOTPRINT_MARGIN - 0.05, y0: 0, y1: 0.3 };
    shape.addBox(logPile, SHAPE_COLORS.logs);
    return shape.build();
  }
}
