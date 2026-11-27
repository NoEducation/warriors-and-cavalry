// One tick of a raider: fight the nearest soldier or worker in sight, else march on the Keep (or the nearest
// building), breaking through the building in its way when walls cut it off.
import { type Battlefield, distanceTo, type TargetPlace } from './Battlefield';
import type { Breach } from './Breach';
import type { MapObject } from './MapObject';
import { ObjectKind } from './ObjectKind';
import type { Unit } from './Unit';
import { Side, UNIT_KINDS } from './UnitKind';
import type { UnitTarget } from './UnitView';
import type { UnitWalks } from './UnitWalks';

/** What a raider brain reads of the army: the units, and the standing buildings raiders may attack. */
export interface RaidGround {
  readonly units: ReadonlyMap<number, Unit>;
  /** Attackable buildings in ascending id order. */
  readonly buildings: ReadonlyMap<number, MapObject>;
}

export class RaiderBrain {
  /** Raiders fighting on `field` over `ground`, walking with `walks` and breaking through with `breach`. */
  public constructor(
    private readonly field: Battlefield,
    private readonly walks: UnitWalks,
    private readonly breach: Breach,
    private readonly ground: RaidGround,
  ) {}

  /** Advances the raider `unit` by one tick. Call once per tick per living raider, in ascending id order. */
  public tick(unit: Unit): void {
    const target = this.choose(unit);
    unit.setTarget(target);
    const place = target ? this.field.place(target) : null;
    if (!target || !place) return this.walks.halt(unit);
    if (this.walks.pursue(unit, target, place) === 'busy') return;
    if (target.type !== 'building') {
      unit.ignoreTarget();
      return this.walks.halt(unit);
    }
    const hole = this.holeFor(unit, target.id, place);
    const holePlace = hole === null ? null : this.field.place({ type: 'building', id: hole });
    if (hole !== null && holePlace) {
      unit.setTarget({ type: 'building', id: hole });
      if (this.walks.pursue(unit, unit.target!, holePlace) === 'busy') return;
    }
    unit.waitToRetry();
    this.walks.halt(unit);
  }

  /**
   * Its target this tick: the unit or worker it fights while it lives and stays in sight; else the nearest enemy in
   * sight; else the building it already goes for; else the building it marches on.
   */
  private choose(unit: Unit): UnitTarget | null {
    const sight = UNIT_KINDS[unit.kind].sight;
    const current = unit.target;
    const place = current ? this.field.place(current) : null;
    if (current && place && current.type !== 'building' && distanceTo(unit.tx, unit.ty, place) <= sight) return current;
    const enemy = this.field.nearestEnemy(unit, true);
    if (enemy) return enemy;
    if (current?.type === 'building' && place) return current;
    const march = this.marchTarget(unit);
    return march ? { type: 'building', id: march.id } : null;
  }

  /** The lowest-id Keep; with none, the nearest attackable building (ties to the lowest id); null with none. */
  private marchTarget(unit: Unit): MapObject | null {
    let nearest: MapObject | null = null;
    let best = Infinity;
    for (const building of this.ground.buildings.values()) {
      if (building.kind === ObjectKind.Keep) return building;
      const place = this.field.place({ type: 'building', id: building.id });
      const d = place ? distanceTo(unit.tx, unit.ty, place) : Infinity;
      if (d < best) [nearest, best] = [building, d];
    }
    return nearest;
  }

  /**
   * The building to break so `unit` gets through to building `goalId`: the hole another raider in sight is already
   * breaking (so a group hacks at one), else the first building on its own way there.
   */
  private holeFor(unit: Unit, goalId: number, goal: TargetPlace): number | null {
    const sight = UNIT_KINDS[unit.kind].sight;
    for (const other of this.ground.units.values()) {
      if (other === unit || other.side !== Side.Raider || !other.alive || other.target?.type !== 'building') continue;
      if (other.target.id === goalId) continue;
      const near = Math.max(Math.abs(other.tx - unit.tx), Math.abs(other.ty - unit.ty)) <= sight;
      if (near && this.field.place(other.target)) return other.target.id;
    }
    return this.breach.find(unit, goal, goalId);
  }
}
