// One tick of a player soldier: walking to its move tile, attacking its named raider, or standing and fighting.
import type { Battlefield } from './Battlefield';
import type { Unit } from './Unit';
import { UnitKind, UNIT_KINDS } from './UnitKind';
import type { UnitWalks } from './UnitWalks';

export class SoldierBrain {
  /** Soldiers fighting on `field`, walking with `walks`. Create once per world. */
  public constructor(
    private readonly field: Battlefield,
    private readonly walks: UnitWalks,
  ) {}

  /** Advances the player soldier `unit` by one tick of its order. Call once per tick per living soldier, by id. */
  public tick(unit: Unit): void {
    if (unit.order === 'move') this.move(unit);
    else if (unit.order === 'attack') this.attack(unit);
    else this.stand(unit);
  }

  /**
   * Walks to the move tile, ignoring enemies; standing on it at the end of the walk, it becomes idle. A move tile it
   * cannot reach (now or after its way is built over) leaves it idle where it stands.
   */
  private move(unit: Unit): void {
    const there = unit.tx === unit.moveTx && unit.ty === unit.moveTy;
    if (unit.walkDone && there) return unit.setOrder('idle', null);
    if (this.walks.isStuck(unit) && !this.walks.plan(unit, [{ tx: unit.moveTx, ty: unit.moveTy }])) {
      this.walks.halt(unit);
      return unit.setOrder('idle', null);
    }
    this.walks.step(unit);
  }

  /** Goes for its named raider wherever it is; when the raider is dead or out of every way, it becomes idle. */
  private attack(unit: Unit): void {
    const target = unit.target;
    const place = target ? this.field.place(target) : null;
    if (target && place && this.walks.pursue(unit, target, place) === 'busy') return;
    this.walks.halt(unit);
    unit.setOrder('idle', null);
  }

  /**
   * Fights what comes near: a Spearman goes for the nearest raider in sight it may strike (only within reach for a
   * while after one was out of every way), an Archer only shoots the nearest in reach and never walks on its own (so
   * archers stay on the walls). With none it stands.
   */
  private stand(unit: Unit): void {
    const chases = unit.kind !== UnitKind.Archer && unit.ignoreTicks === 0;
    const range = chases ? UNIT_KINDS[unit.kind].sight : this.field.reach(unit);
    const kept = unit.target ? this.field.place(unit.target) : null;
    const keep = kept && unit.target && this.field.canStrike(unit, kept) && distanceOk(unit, kept, range);
    if (!keep) unit.setTarget(this.field.nearestEnemy(unit, false, range));
    const target = unit.target;
    const place = target ? this.field.place(target) : null;
    if (!target || !place) return this.walks.halt(unit);
    if (this.walks.pursue(unit, target, place) === 'noWay') {
      unit.ignoreTarget();
      this.walks.halt(unit);
    }
  }
}

/** True when `place` is within `range` of where `unit` stands. */
function distanceOk(unit: Unit, place: { tx: number; ty: number }, range: number): boolean {
  return Math.max(Math.abs(place.tx - unit.tx), Math.abs(place.ty - unit.ty)) <= range;
}
