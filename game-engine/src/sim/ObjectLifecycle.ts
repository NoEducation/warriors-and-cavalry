// Adding and removing objects: the building rules and cost, then every part of the world that follows the objects,
// updated in one fixed order.
import type { Army } from './Army';
import type { Economy } from './Economy';
import { Footprint } from './Footprint';
import type { GameMap } from './GameMap';
import type { Listeners } from './Listeners';
import type { MapObject } from './MapObject';
import { OBJECT_KINDS, type ObjectKind } from './ObjectKind';
import type { ObjectIndex } from './ObjectIndex';
import { checkPlacement } from './placementRules';
import type { Population } from './Population';
import type { Production } from './Production';
import type { Structures } from './Structures';
import type { Stumps } from './Stumps';
import type { WallSite } from './WallBuilder';
import type { ObjectCommandResult, PlacementCheck, WorldChange } from './WorldCommand';

/** The parts of a world that follow its objects, in the order they are told about a change. */
export interface ObjectFollowers {
  readonly index: ObjectIndex;
  readonly economy: Economy;
  readonly structures: Structures;
  readonly production: Production;
  readonly population: Population;
  readonly army: Army;
  readonly stumps: Stumps;
  readonly listeners: Listeners<WorldChange>;
}

export class ObjectLifecycle implements WallSite {
  private nextId = 1;

  /** Adds and removes objects on `map`, keeping `parts` in step. Create once per world. */
  public constructor(
    private readonly map: GameMap,
    private readonly parts: ObjectFollowers,
  ) {}

  /** Whether a building of `kind` may stand at (tx, ty); see `World.canPlace`. Does not look at resources. */
  public canPlace(kind: ObjectKind, tx: number, ty: number): PlacementCheck {
    const { index } = this.parts;
    return checkPlacement(this.map, kind, tx, ty, (footprint) => index.isFree(footprint), (x, y) => index.objectAt(x, y)?.kind);
  }

  /** Checks the building rules, pays the cost and adds the building. Call for a `placeBuilding` command. */
  public placeBuilding(kind: ObjectKind, tx: number, ty: number): ObjectCommandResult {
    const check = this.canPlace(kind, tx, ty);
    if (!check.ok) return check;
    if (!this.parts.economy.spend(OBJECT_KINDS[kind].cost)) return { ok: false, reason: 'NotEnoughResources' };
    return { ok: true, object: this.add(kind, tx, ty) };
  }

  /** Removes a building, then refunds part of its cost into the capacity that remains. Call for `demolish`. */
  public demolish(objectId: number): ObjectCommandResult {
    const object = this.parts.index.objectById(objectId);
    if (!object) return { ok: false, reason: 'UnknownObject' };
    if (!OBJECT_KINDS[object.kind].buildable) return { ok: false, reason: 'NotDemolishable' };
    this.detach(object, true);
    return { ok: true, object };
  }

  /** Removes `object` without any rule or refund: a felled tree, a cleared stump, a wrecked building. Call from `World.tick` only. */
  public remove(object: MapObject): void {
    this.detach(object, false);
  }

  /** Adds an object without building rules or cost; see `World.spawn`. Throws a RangeError where it cannot stand. */
  public spawn(kind: ObjectKind, tx: number, ty: number): MapObject {
    const footprint = Footprint.of(kind, tx, ty);
    if (!footprint.inBounds(this.map)) throw new RangeError(`footprint at (${tx}, ${ty}) out of bounds`);
    if (!this.parts.index.isFree(footprint)) throw new RangeError(`footprint at (${tx}, ${ty}) occupied`);
    return this.add(kind, tx, ty);
  }

  /**
   * Adds the object, its storage capacity, production and housing, then tells the listeners. Checks no building rule
   * and pays nothing: the callers have done both, or (the map generator) skip them on purpose.
   */
  public add(kind: ObjectKind, tx: number, ty: number): MapObject {
    const { index, economy, structures, production, population, army, stumps, listeners } = this.parts;
    const object: MapObject = Object.freeze({ id: this.nextId++, kind, tx, ty });
    // Fixed order: occupancy -> capacity -> hit points -> production -> population -> army -> stumps -> listeners
    // (who see the end state).
    index.insert(object);
    economy.addCapacity(OBJECT_KINDS[kind].storage);
    structures.added(object);
    production.added(object);
    population.buildingAdded(object);
    army.buildingAdded(object);
    stumps.added(object);
    listeners.notify({ type: 'added', object });
    return object;
  }

  /**
   * Fixed order: occupancy -> capacity (and, with `refund`, half the cost back) -> hit points -> production ->
   * population -> army -> stumps -> listeners (who see the end state).
   */
  private detach(object: MapObject, refund: boolean): void {
    const { index, economy, structures, production, population, army, stumps, listeners } = this.parts;
    const info = OBJECT_KINDS[object.kind];
    index.remove(object);
    economy.removeCapacity(info.storage);
    if (refund) economy.refund(info.cost);
    structures.removed(object);
    production.removed(object);
    population.buildingRemoved(object);
    army.buildingRemoved(object);
    stumps.removed(object);
    listeners.notify({ type: 'removed', object });
  }
}
