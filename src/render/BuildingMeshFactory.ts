// Low-poly meshes for each buildable object kind, each built by its own shape class.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../sim/ObjectKind';
import type { BuildingShape } from './buildings/BuildingShape';
import { GranaryShape } from './buildings/GranaryShape';
import { HovelShape } from './buildings/HovelShape';
import { KeepShape } from './buildings/KeepShape';
import { QuarryShape } from './buildings/QuarryShape';
import { StockpileShape } from './buildings/StockpileShape';
import { WheatFarmShape } from './buildings/WheatFarmShape';
import { WoodcutterHutShape } from './buildings/WoodcutterHutShape';

export class BuildingMeshFactory {
  private readonly shapes = new Map<ObjectKind, BuildingShape>([
    [ObjectKind.Keep, new KeepShape()],
    [ObjectKind.Hovel, new HovelShape()],
    [ObjectKind.WoodcutterHut, new WoodcutterHutShape()],
    [ObjectKind.Stockpile, new StockpileShape()],
    [ObjectKind.Granary, new GranaryShape()],
    [ObjectKind.Quarry, new QuarryShape()],
    [ObjectKind.WheatFarm, new WheatFarmShape()],
  ]);

  /**
   * Creates a new group for a building of `kind`. Local origin is the footprint's lowest-coordinate corner, y = 0 is the
   * floor. The caller owns the result and disposes it. Throws for kinds that are not buildings (trees).
   */
  public create(kind: ObjectKind): THREE.Group {
    const shape = this.shapes.get(kind);
    if (!shape) throw new Error(`${OBJECT_KINDS[kind]?.name ?? kind} is not a building`);
    return shape.build();
  }
}
