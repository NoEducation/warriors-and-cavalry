// Breaching: when buildings wall raiders off from what they march on, the building in their way.
import type { ArmyHost } from './ArmyHost';
import type { TargetPlace } from './Battlefield';
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
    const goals: TileCoord[] = [];
    for (let ty = goal.ty; ty < goal.ty + goal.height; ty++) for (let tx = goal.tx; tx < goal.tx + goal.width; tx++) goals.push({ tx, ty });
    const path = this.walker.findPath({ tx: unit.nextTx, ty: unit.nextTy }, goals, this.throughBuildings, WalkMode.Ground);
    if (!path) return null;
    for (const { tx, ty } of path) {
      const object = this.world.objectAt(tx, ty);
      if (!object || !this.world.isAttackable(object.id)) continue;
      return object.id === goalId ? null : object.id;
    }
    return null;
  }
}
