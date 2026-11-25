// The simulation state: a map, the objects standing on it and the camp's economy, changed only through commands.
import { Economy, type EconomyView } from './Economy';
import { Footprint } from './Footprint';
import type { GameMap } from './GameMap';
import type { MapObject } from './MapObject';
import { OBJECT_KINDS, ObjectKind } from './ObjectKind';
import { Listeners } from './Listeners';
import { ObjectIndex } from './ObjectIndex';
import type { PeasantView } from './Peasant';
import { checkPlacement } from './placementRules';
import { Population, type PopulationSummary } from './Population';
import { Production, type ProductionState } from './Production';
import type { TileCoord } from './TileCoord';
import type { CommandResult, PlacementCheck, WorldChange, WorldCommand } from './WorldCommand';

export class World {
  private readonly index: ObjectIndex;
  private readonly listeners = new Listeners<WorldChange>();
  private readonly production: Production;
  private readonly populace: Population;
  private nextId = 1;
  private ticks = 0;

  /** Creates a world with no objects on `map`, holding `economyState` (by default the usual start amounts). */
  public constructor(public readonly map: GameMap, private readonly economyState: Economy = new Economy()) {
    this.index = new ObjectIndex(map);
    const isTreeAt = (tx: number, ty: number): boolean => this.objectAt(tx, ty)?.kind === ObjectKind.Tree;
    this.production = new Production(map, economyState, isTreeAt);
    this.populace = new Population(this, economyState);
  }

  /** Read-only view of `economyState`: resource amounts and capacities, changed only through `apply` and `tick`. */
  public get economy(): EconomyView {
    return this.economyState;
  }

  /** Number of simulation ticks run since the world was generated. */
  public get tickCount(): number {
    return this.ticks;
  }

  /** Advances the world by one simulation tick. Called by the game loop as many times as the runner says. */
  public tick(): void {
    this.ticks++;
    this.populace.tick();
    this.production.tick();
  }

  /** All peasants in ascending id order. */
  public peasants(): Iterable<PeasantView> {
    return this.populace.peasants();
  }

  /** How many peasants there are, how many the buildings house and how many are idle. */
  public get population(): PopulationSummary {
    const p = this.populace;
    return { count: p.count, housing: p.housing, idle: p.idleCount };
  }

  /** Ticks counted toward the next peasant's arrival; 0 while nobody can arrive. */
  public get arrivalTimer(): number {
    return this.populace.arrivalTimer;
  }

  /** What the production building `objectId` is doing; null for objects that do not produce or do not exist. */
  public productionState(objectId: number): ProductionState | null {
    return this.production.state(objectId);
  }

  /** Ticks done in the current cycle of production building `objectId`, else null. Allocation-free, for per-frame use. */
  public productionProgress(objectId: number): number | null {
    return this.production.progress(objectId);
  }

  /** Number of objects currently in the world. */
  public get objectCount(): number {
    return this.index.count;
  }

  /** The object with `id`, or undefined when there is none. */
  public objectById(id: number): MapObject | undefined {
    return this.index.objectById(id);
  }

  /** The object covering tile (tx, ty), or undefined when the tile is free or outside the map. */
  public objectAt(tx: number, ty: number): MapObject | undefined {
    return this.index.objectAt(tx, ty);
  }

  /** Whether a walker may stand on tile (tx, ty): inside the map, not water, and free or a tree. */
  public isWalkable(tx: number, ty: number): boolean {
    return this.index.isWalkable(tx, ty);
  }

  /** The walkable tiles sharing an edge with object `objectId`, row by row; [] for an unknown id. */
  public accessTiles(objectId: number): TileCoord[] {
    return this.index.accessTiles(objectId);
  }

  /** All objects in ascending id order. Do not add or remove objects while iterating. */
  public objects(): Iterable<MapObject> {
    return this.index.objects();
  }

  /**
   * Whether a building of `kind` may be placed with its footprint starting at (tx, ty); the first failing rule wins
   * (see `checkPlacement`). Does not look at resources. An unknown `kind` is reported as NotBuildable.
   */
  public canPlace(kind: ObjectKind, tx: number, ty: number): PlacementCheck {
    return checkPlacement(this.map, kind, tx, ty, (footprint) => this.index.isFree(footprint));
  }

  /** Executes a player command. On failure, including a malformed command, nothing changes and no listener is called. */
  public apply(command: WorldCommand): CommandResult {
    switch (command.type) {
      case 'placeBuilding': {
        const check = this.canPlace(command.kind, command.tx, command.ty);
        if (!check.ok) return check;
        const paid = this.economyState.spend(OBJECT_KINDS[command.kind].cost);
        if (!paid) return { ok: false, reason: 'NotEnoughResources' };
        return { ok: true, object: this.add(command.kind, command.tx, command.ty) };
      }
      case 'demolish':
        return this.demolish(command.objectId);
      default:
        return { ok: false, reason: 'UnknownCommand' };
    }
  }

  /**
   * Adds an object without the building rules (buildable, terrain, slope, cost). For the map generator only;
   * throws a RangeError when the kind is unknown or the footprint is outside the map or occupied.
   */
  public spawn(kind: ObjectKind, tx: number, ty: number): MapObject {
    const footprint = Footprint.of(kind, tx, ty);
    if (!footprint.inBounds(this.map)) throw new RangeError(`footprint at (${tx}, ${ty}) out of bounds`);
    if (!this.index.isFree(footprint)) throw new RangeError(`footprint at (${tx}, ${ty}) occupied`);
    return this.add(kind, tx, ty);
  }

  /** Calls `listener` for every object added or removed from now on. Returns a function that unsubscribes it. */
  public onChange(listener: (change: WorldChange) => void): () => void {
    return this.listeners.add(listener);
  }

  /** Removes the object, then refunds part of its cost into the capacity that remains. */
  private demolish(objectId: number): CommandResult {
    const object = this.index.objectById(objectId);
    if (!object) return { ok: false, reason: 'UnknownObject' };
    const info = OBJECT_KINDS[object.kind];
    if (!info.buildable) return { ok: false, reason: 'NotDemolishable' };
    // Fixed order: occupancy -> capacity (and refund) -> production -> population -> listeners (who see the end state).
    this.index.remove(object);
    this.economyState.removeCapacity(info.storage);
    this.economyState.refund(info.cost);
    this.production.removed(object);
    this.populace.buildingRemoved(object);
    this.listeners.notify({ type: 'removed', object });
    return { ok: true, object };
  }

  /** Adds the object, its storage capacity, production and housing, then tells the listeners. */
  private add(kind: ObjectKind, tx: number, ty: number): MapObject {
    const object: MapObject = Object.freeze({ id: this.nextId++, kind, tx, ty });
    // Fixed order: occupancy -> capacity -> production -> population -> listeners (who see the end state).
    this.index.insert(object);
    this.economyState.addCapacity(OBJECT_KINDS[kind].storage);
    this.production.added(object);
    this.populace.buildingAdded(object);
    this.listeners.notify({ type: 'added', object });
    return object;
  }
}
