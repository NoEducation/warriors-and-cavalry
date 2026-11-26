// Low-poly meshes for each buildable object kind, each built by its own shape class.
import type * as THREE from 'three';
import { OBJECT_KINDS, ObjectKind } from '../sim/ObjectKind';
import type { BuildingShape } from './buildings/BuildingShape';
import { type GatePassage, GateShape } from './buildings/GateShape';
import { GranaryShape } from './buildings/GranaryShape';
import { HovelShape } from './buildings/HovelShape';
import { KeepShape } from './buildings/KeepShape';
import { QuarryShape } from './buildings/QuarryShape';
import { StockpileShape } from './buildings/StockpileShape';
import { TowerShape } from './buildings/TowerShape';
import { WallShape } from './buildings/WallShape';
import { WheatFarmShape } from './buildings/WheatFarmShape';
import { WoodcutterHutShape } from './buildings/WoodcutterHutShape';

export type { GatePassage } from './buildings/GateShape';

export class BuildingMeshFactory {
  /** Gates are built apart from `shapes`: their shape also takes the passage direction. */
  private readonly gate = new GateShape();
  private readonly shapes = new Map<ObjectKind, BuildingShape>([
    [ObjectKind.Keep, new KeepShape()],
    [ObjectKind.Hovel, new HovelShape()],
    [ObjectKind.WoodcutterHut, new WoodcutterHutShape()],
    [ObjectKind.Stockpile, new StockpileShape()],
    [ObjectKind.Granary, new GranaryShape()],
    [ObjectKind.Quarry, new QuarryShape()],
    [ObjectKind.WheatFarm, new WheatFarmShape()],
    [ObjectKind.Wall, new WallShape()],
    [ObjectKind.Tower, new TowerShape()],
  ]);

  /**
   * Creates a new single mesh (one draw call) for a building of `kind`. Local origin is the footprint's
   * lowest-coordinate corner, y = 0 is the floor. The caller owns the result and disposes it (`disposeObject`).
   * `passage` turns a Gate's opening (east–west when left out) and is ignored for other kinds.
   * Throws for kinds that are not buildings (trees).
   */
  public create(kind: ObjectKind, passage?: GatePassage): THREE.Mesh {
    if (kind === ObjectKind.Gate) return this.gate.build(passage);
    const shape = this.shapes.get(kind);
    if (!shape) throw new Error(`${OBJECT_KINDS[kind]?.name ?? kind} is not a building`);
    return shape.build();
  }
}
