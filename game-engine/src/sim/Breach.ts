// Breaching: when buildings wall raiders off from what they march on, the building in their way.
import type { ArmyHost } from './ArmyHost';
import type { TargetPlace } from './Battlefield';
import type { MapObject } from './MapObject';
import { OBJECT_KINDS } from './ObjectKind';
import type { StepWalker } from './StepWalker';
import type { TileCoord } from './TileCoord';
import { TileType } from './tiles';
import type { Unit } from './Unit';
import { WalkClass, type WalkClassOf, WalkMode } from './walkRules';

export class Breach {
  /** Every tile but water (and outside the map) counts as ground: the way a raider would go if no building stood. */
  private readonly throughBuildings: WalkClassOf;

  /** Breaches in `world`, searched with `walker`. Create once per world. */
  public constructor(
    private readonly world: ArmyHost,
    private readonly walker: StepWalker,
  ) {
    this.throughBuildings = (tx, ty) => {
      const tile = world.map.tileAt(tx, ty);
      return tile === undefined || tile === TileType.Water ? WalkClass.Blocked : WalkClass.Ground;
    };
  }

  /**
   * The id of the first building on the way from `unit` to the building at `goal` if no building stood (water still
   * stops it), not counting `goalId` itself; null when water cuts it off or no other building is in the way.
   */
  public find(unit: Unit, goal: TargetPlace, goalId: number): number | null {
    const path = this.walker.findPath({ tx: unit.nextTx, ty: unit.nextTy }, footprintTiles(goal), this.throughBuildings, WalkMode.Ground);
    if (!path) return null;
    for (const { tx, ty } of path) {
      const object = this.world.objectAt(tx, ty);
      if (!object || !this.world.isAttackable(object.id)) continue;
      return object.id === goalId ? null : object.id;
    }
    return null;
  }

  /** True when a raider at `from` could get to `building` by breaking through whatever stands in the way. */
  public reaches(from: TileCoord, building: MapObject): boolean {
    const { width, height } = OBJECT_KINDS[building.kind];
    const goals = footprintTiles({ tx: building.tx, ty: building.ty, width, height });
    return this.walker.findPath(from, goals, this.throughBuildings, WalkMode.Ground) !== null;
  }
}

/** Every tile of the footprint `place`, row by row. */
function footprintTiles(place: { tx: number; ty: number; width: number; height: number }): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let ty = place.ty; ty < place.ty + place.height; ty++) for (let tx = place.tx; tx < place.tx + place.width; tx++) tiles.push({ tx, ty });
  return tiles;
}
