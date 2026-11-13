// The Woodcutter's hut: a house with a gable roof running along x and a log pile beside it.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../../sim/ObjectKind';
import type { BuildingShape } from './BuildingShape';
import { type BoxSpec, boxMesh, FOOTPRINT_MARGIN, gableRoof, groupWithFoundation, SHAPE_COLORS } from './shapeParts';

export class WoodcutterHutShape implements BuildingShape {
  /** Creates a new Woodcutter's hut model (see `BuildingShape.build`). */
  public build(): THREE.Group {
    const { width: w, height: d } = OBJECT_KINDS[ObjectKind.WoodcutterHut];
    const group = groupWithFoundation(w, d);
    const walls: BoxSpec = { x0: 0.3, z0: 0.35, x1: w - 0.3, z1: d - 0.7, y0: 0, y1: 0.85 };
    group.add(boxMesh(walls, SHAPE_COLORS.darkTimber));
    group.add(gableRoof(walls, 0.7, 0.12, SHAPE_COLORS.hutRoof));
    const logPile: BoxSpec = { x0: 0.4, z0: d - 0.5, x1: w - 0.6, z1: d - FOOTPRINT_MARGIN - 0.05, y0: 0, y1: 0.3 };
    group.add(boxMesh(logPile, SHAPE_COLORS.logs));
    return group;
  }
}
