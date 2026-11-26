// Adding and removing objects: the building rules and cost, then every part of the world that follows the objects,
// updated in one fixed order.
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
import type { WallSite } from './WallBuilder';
import type { ObjectCommandResult, PlacementCheck, WorldChange } from './WorldCommand';

/** The parts of a world that follow its objects, in the order they are told about a change. */
export interface ObjectFollowers {
  readonly index: ObjectIndex;
  readonly economy: Economy;
  readonly production: Production;
  readonly population: Population;
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
    return checkPlacement(this.map, kind, tx, ty, (footprint) => this.parts.index.isFree(footprint));
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
    const { index, economy, production, population, listeners } = this.parts;
    const object = index.objectById(objectId);
    if (!object) return { ok: false, reason: 'UnknownObject' };
    const info = OBJECT_KINDS[object.kind];
    if (!info.buildable) return { ok: false, reason: 'NotDemolishable' };
    // Fixed order: occupancy -> capacity (and refund) -> production -> population -> listeners (who see the end state).
    index.remove(object);
    economy.removeCapacity(info.storage);
    economy.refund(info.cost);
    production.removed(object);
    population.buildingRemoved(object);
    listeners.notify({ type: 'removed', object });
    return { ok: true, object };
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
    const { index, economy, production, population, listeners } = this.parts;
    const object: MapObject = Object.freeze({ id: this.nextId++, kind, tx, ty });
    // Fixed order: occupancy -> capacity -> production -> population -> listeners (who see the end state).
    index.insert(object);
    economy.addCapacity(OBJECT_KINDS[kind].storage);
    production.added(object);
    population.buildingAdded(object);
    listeners.notify({ type: 'added', object });
    return object;
  }
}
