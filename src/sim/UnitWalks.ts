// Walking units: to a tile, or after a target until it is in reach, and then striking it.
import type { ArmyHost } from './ArmyHost';
import { type Battlefield, distanceTo, type TargetPlace } from './Battlefield';
import { COMBAT_CONFIG } from './combatConfig';
import { ObjectKind } from './ObjectKind';
import { PATH_CONFIG } from './pathConfig';
import type { StepWalker } from './StepWalker';
import type { TileCoord } from './TileCoord';
import type { Unit } from './Unit';
import { Side, UnitKind } from './UnitKind';
import type { UnitTarget } from './UnitView';
import { WalkClass, type WalkClassOf, WalkMode } from './walkRules';

const NO_TILES: readonly TileCoord[] = Object.freeze([]);

/** What `pursue` did: struck or walked on (`busy`), or found no way to the target (`noWay`). */
export type PursuitResult = 'busy' | 'noWay';

export class UnitWalks {
  /** Raiders see gates as walls: a gate lets only the player's people through. */
  public readonly raiderWalkClass: WalkClassOf;

  /** Walks units over `world` with `walker`, fighting on `field`. Create once per world. */
  public constructor(
    private readonly world: ArmyHost,
    private readonly walker: StepWalker,
    private readonly field: Battlefield,
  ) {
    this.raiderWalkClass = (tx, ty) => {
      const c = world.walkClass(tx, ty);
      return c === WalkClass.Ground && this.world.objectAt(tx, ty)?.kind === ObjectKind.Gate ? WalkClass.Blocked : c;
    };
  }

  /** The walk classes `unit`'s side walks over. */
  public classesFor(unit: Unit): WalkClassOf {
    return unit.side === Side.Raider ? this.raiderWalkClass : this.world.walkClass.bind(this.world);
  }

  /**
   * Plans `unit`'s walk to the nearest of `goals`: raiders on the ground only, player soldiers also up stairs (and,
   * stranded on a wall top, straight down). False, and no walk, when none is reachable within `maxExpanded`.
   */
  public plan(unit: Unit, goals: readonly TileCoord[], maxExpanded: number = PATH_CONFIG.maxExpanded): boolean {
    if (unit.side === Side.Raider) return this.walker.walkTo(unit, goals, maxExpanded, WalkMode.Ground, this.raiderWalkClass);
    if (this.walker.walkTo(unit, goals, maxExpanded, WalkMode.Climb)) return true;
    return this.field.isTop(unit.nextTx, unit.nextTy) && this.walker.walkTo(unit, goals, maxExpanded, WalkMode.Down);
  }

  /** Advances `unit`'s current walk by one tick. */
  public step(unit: Unit): void {
    this.walker.tick(unit, this.classesFor(unit));
  }

  /** Stops `unit` after its current step (it finishes the step it is on). */
  public halt(unit: Unit): void {
    if (unit.pathIndex < unit.path.length) unit.startWalk(NO_TILES, unit.walkMode);
    if (unit.stepTicks > 0) this.step(unit);
  }

  /** True when `unit`'s walk can no longer go on: it has ended, or its next step was built over. */
  public isStuck(unit: Unit): boolean {
    return unit.walkDone || this.walker.isNextStepBlocked(unit, this.classesFor(unit));
  }

  /**
   * One tick of `unit` going for `target` (standing at `place`): strikes when it is in reach and the strike is ready
   * (finishing its step first), else walks toward it, searching again when the walk ends or is blocked, or (every
   * `chaseReplanTicks`, staggered by id) when the target has moved. A failed search is `noWay`; a unit waiting after
   * one only counts its wait down.
   */
  public pursue(unit: Unit, target: UnitTarget, place: TargetPlace): PursuitResult {
    if (this.field.inReach(unit, place)) {
      this.halt(unit);
      if (unit.stepTicks === 0 && unit.cooldown === 0) this.field.strike(unit, target);
      return 'busy';
    }
    if (unit.waitTicks > 0 && --unit.waitTicks > 0) return 'busy';
    const moved = place.tx !== unit.chaseTx || place.ty !== unit.chaseTy;
    const due = (this.world.tickCount + unit.id) % COMBAT_CONFIG.chaseReplanTicks === 0;
    const planned = unit.chaseTx >= 0;
    if (planned && unit.walkDone && !moved) return 'noWay'; // walked as far as it can and still not in reach
    if (!planned || this.isStuck(unit) || (moved && due)) {
      const limit = target.type === 'building' ? PATH_CONFIG.maxExpanded : COMBAT_CONFIG.chaseMaxExpanded;
      if (!this.plan(unit, this.reachTiles(unit, place), limit)) return 'noWay';
      unit.chaseTx = place.tx;
      unit.chaseTy = place.ty;
    }
    this.step(unit);
    return 'busy';
  }

  /**
   * The tiles from which `unit` could strike `place` (within its reach, not on it for a building; for a Spearman only
   * tiles on the target's own level, wall top or ground), row by row.
   */
  public reachTiles(unit: Unit, place: TargetPlace): TileCoord[] {
    const reach = this.field.reach(unit);
    const melee = unit.kind === UnitKind.Spearman;
    const { width, height } = this.world.map;
    const tiles: TileCoord[] = [];
    for (let ty = Math.max(0, place.ty - reach); ty <= Math.min(height - 1, place.ty + place.height - 1 + reach); ty++) {
      for (let tx = Math.max(0, place.tx - reach); tx <= Math.min(width - 1, place.tx + place.width - 1 + reach); tx++) {
        const d = distanceTo(tx, ty, place);
        if (d > reach || (d === 0 && place.width > 1) || (melee && this.field.isTop(tx, ty) !== place.onTop)) continue;
        tiles.push({ tx, ty });
      }
    }
    return tiles;
  }
}
