// What units fight over: where a target stands, who is in reach or in sight, who may strike whom, and the strike.
import type { ArmyHost } from './ArmyHost';
import { COMBAT_CONFIG } from './combatConfig';
import { Footprint } from './Footprint';
import type { TileCoord } from './TileCoord';
import type { Unit } from './Unit';
import { UnitKind, UNIT_KINDS } from './UnitKind';
import type { UnitTarget } from './UnitView';
import { WalkClass } from './walkRules';

/** Where a living target stands: its tile, or a building's footprint. */
export interface TargetPlace {
  readonly tx: number;
  readonly ty: number;
  readonly width: number;
  readonly height: number;
  /** True for a unit or peasant on a wall or tower top. */
  readonly onTop: boolean;
}

/** `max(|dx|, |dy|)` from (tx, ty) to the nearest tile of `place`; 0 on it. */
export function distanceTo(tx: number, ty: number, place: TargetPlace): number {
  const dx = Math.max(place.tx - tx, 0, tx - (place.tx + place.width - 1));
  const dy = Math.max(place.ty - ty, 0, ty - (place.ty + place.height - 1));
  return Math.max(dx, dy);
}

export class Battlefield {
  /** Fights in `world` between the units `units` (ascending id order). Create once per world. */
  public constructor(
    private readonly world: ArmyHost,
    private readonly units: ReadonlyMap<number, Unit>,
    /** Takes hit points from a building; one at 0 falls (see `ArmyHost.damageBuilding`). */
    private readonly damageBuilding: (objectId: number, amount: number) => void,
  ) {}

  /** True when tile (tx, ty) is a wall or tower top. */
  public isTop(tx: number, ty: number): boolean {
    return this.world.walkClass(tx, ty) === WalkClass.Top;
  }

  /** Where `target` stands; null when it is gone or dead. */
  public place(target: UnitTarget): TargetPlace | null {
    if (target.type === 'building') {
      const object = this.world.objectById(target.id);
      if (!object || !this.world.isAttackable(target.id)) return null;
      const { width, height } = Footprint.of(object.kind, object.tx, object.ty);
      return { tx: object.tx, ty: object.ty, width, height, onTop: false };
    }
    const walker = target.type === 'unit' ? this.units.get(target.id) : this.world.peasantById(target.id);
    if (!walker || walker.hitPoints <= 0) return null;
    return { tx: walker.tx, ty: walker.ty, width: 1, height: 1, onTop: this.isTop(walker.tx, walker.ty) };
  }

  /** How far `unit` strikes from where it stands: its kind's reach, more for an Archer on a wall top. */
  public reach(unit: Unit): number {
    const { reach } = UNIT_KINDS[unit.kind];
    return unit.kind === UnitKind.Archer && this.isTop(unit.tx, unit.ty) ? reach + COMBAT_CONFIG.wallTopReachBonus : reach;
  }

  /** True when `unit` may strike something at `place`: Spearmen only strike on their own level (wall top or ground). */
  public canStrike(unit: Unit, place: TargetPlace): boolean {
    return unit.kind !== UnitKind.Spearman || place.onTop === this.isTop(unit.tx, unit.ty);
  }

  /** True when `place` is within `unit`'s reach and it may strike there. */
  public inReach(unit: Unit, place: TargetPlace): boolean {
    return this.canStrike(unit, place) && distanceTo(unit.tx, unit.ty, place) <= this.reach(unit);
  }

  /**
   * The nearest enemy `unit` may strike within `range` tiles (by default its sight): units of the other side, then
   * (with `peasants`) workers; ties go to units, then to the lowest id. Its ignored target is skipped.
   */
  public nearestEnemy(unit: Unit, peasants: boolean, range: number = UNIT_KINDS[unit.kind].sight): UnitTarget | null {
    let best: UnitTarget | null = null;
    let bestDistance = range + 1;
    for (const other of this.units.values()) {
      if (other.side === unit.side || !other.alive || other.id === unit.ignoreId) continue;
      const d = this.closer(unit, other, bestDistance);
      if (d < bestDistance) [best, bestDistance] = [{ type: 'unit', id: other.id }, d];
    }
    if (!peasants) return best;
    for (const p of this.world.peasants()) {
      if (p.hitPoints <= 0 || p.id === unit.ignoreId) continue;
      const d = this.closer(unit, p, bestDistance);
      if (d < bestDistance) [best, bestDistance] = [{ type: 'peasant', id: p.id }, d];
    }
    return best;
  }

  /** `unit` strikes `target` now: the damage lands, and a building at 0 falls. */
  public strike(unit: Unit, target: UnitTarget): void {
    const { damage } = UNIT_KINDS[unit.kind];
    unit.strike(this.world.tickCount);
    if (target.type === 'unit') {
      const other = this.units.get(target.id);
      if (other) other.hitPoints -= damage;
    } else if (target.type === 'peasant') {
      this.world.damagePeasant(target.id, damage);
    } else {
      this.damageBuilding(target.id, damage);
    }
  }

  /** The distance from `unit` to `other` when `unit` may strike it and it is nearer than `limit`; else `limit`. */
  private closer(unit: Unit, other: TileCoord, limit: number): number {
    const d = Math.max(Math.abs(other.tx - unit.tx), Math.abs(other.ty - unit.ty));
    if (d >= limit) return limit;
    const onTop = this.isTop(other.tx, other.ty);
    return this.canStrike(unit, { tx: other.tx, ty: other.ty, width: 1, height: 1, onTop }) ? d : limit;
  }
}
