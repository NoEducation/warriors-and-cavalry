// The simulation state: a map, the objects standing on it and the camp's economy, changed only through commands.
import { Army, type SoldierSummary } from './Army';
import { Economy, type EconomyView } from './Economy';
import type { GameMap } from './GameMap';
import type { MapObject } from './MapObject';
import { ObjectKind } from './ObjectKind';
import { Listeners } from './Listeners';
import { ObjectIndex } from './ObjectIndex';
import { ObjectLifecycle } from './ObjectLifecycle';
import type { PeasantView } from './PeasantView';
import { Population, type PopulationSummary } from './Population';
import { Production, type ProductionState } from './Production';
import type { RaidView } from './RaidSchedule';
import { type HitPoints, Structures } from './Structures';
import { Stumps } from './Stumps';
import { TreeFelling } from './TreeFelling';
import type { TileCoord } from './TileCoord';
import type { TrainingQueueView } from './Training';
import type { Side, UnitKind } from './UnitKind';
import type { UnitView } from './UnitView';
import type { WalkClass } from './walkRules';
import { WallBuilder, type WallLinePreview } from './WallBuilder';
import { WorldArmyHost } from './WorldArmyHost';
import {
  type CommandResult,
  type ObjectCommand,
  type ObjectCommandResult,
  type PlacementCheck,
  type WorldChange,
  type WorldCommand,
} from './WorldCommand';

export class World {
  private readonly index: ObjectIndex;
  private readonly listeners = new Listeners<WorldChange>();
  private readonly production: Production;
  private readonly populace: Population;
  private readonly lifecycle: ObjectLifecycle;
  private readonly walls: WallBuilder;
  private readonly stumps = new Stumps();
  private readonly structures = new Structures();
  private readonly felling: TreeFelling;
  private readonly army: Army;
  private ticks = 0;

  /** Creates a world with no objects on `map`, holding `economyState` (by default the usual start amounts). */
  public constructor(public readonly map: GameMap, private readonly economyState: Economy = new Economy()) {
    this.index = new ObjectIndex(map);
    this.production = new Production(map, economyState, (tx, ty) => this.objectAt(tx, ty)?.kind === ObjectKind.Tree);
    this.populace = new Population(this, economyState);
    const { index, structures, production, populace: population, stumps, listeners } = this;
    const economy = economyState;
    const destroy = (object: MapObject): void => this.lifecycle.remove(object);
    this.army = new Army(new WorldArmyHost(this, { economy, structures, population, destroy }));
    const followers = { index, economy, structures, production, population, army: this.army, stumps, listeners };
    this.lifecycle = new ObjectLifecycle(map, followers);
    this.walls = new WallBuilder(this.lifecycle, economyState);
    this.felling = new TreeFelling(index, this.lifecycle, stumps, listeners);
  }

  /** Read-only view of `economyState`: resource amounts and capacities, changed only through `apply` and `tick`. */
  public get economy(): EconomyView {
    return this.economyState;
  }

  /** Number of simulation ticks run since the world was generated. */
  public get tickCount(): number {
    return this.ticks;
  }

  /**
   * Advances the world by one simulation tick: peasants, then production, whose batches the workers pick up (the
   * trees woodcutters finished a round on give it up, the last round fells them into stumps), then stumps whose time
   * is up are cleared away, then the army: training, raids and every unit's fighting.
   */
  public tick(): void {
    this.ticks++;
    this.populace.tick();
    this.felling.chop(this.populace.collect(this.production.tick((id) => this.populace.isWorking(id))));
    this.felling.tick();
    this.army.tick();
  }

  /** All soldiers and raiders in ascending id order. */
  public units(): Iterable<UnitView> {
    return this.army.units();
  }

  /** The unit `id`, or undefined when there is none. */
  public unitById(id: number): UnitView | undefined {
    return this.army.unitById(id);
  }

  /** Living player soldiers, and the room the Barracks give (trained plus queued soldiers may not exceed it). */
  public get soldiers(): SoldierSummary {
    return this.army.soldiers;
  }

  /** What Barracks `objectId` is training; null when it is not a standing Barracks. */
  public trainingQueue(objectId: number): TrainingQueueView | null {
    return this.army.trainingQueue(objectId);
  }

  /** Every Barracks' queue in ascending id order, as [id, queue]; for the checksum. */
  public trainingQueues(): Iterable<readonly [number, TrainingQueueView]> {
    return this.army.trainingQueues();
  }

  /** The raid timer, whether the Keep has fallen, and the raiders alive. */
  public get raids(): RaidView {
    return this.army.raidView;
  }

  /** The id the next unit will get; for the checksum. */
  public get nextUnitId(): number {
    return this.army.nextUnitId;
  }

  /**
   * Adds a unit of `kind` for `side` on tile (tx, ty) without any rule or cost. For setting worlds up (tests,
   * scenarios) only, like `spawn`.
   */
  public spawnUnit(side: Side, kind: UnitKind, tx: number, ty: number): UnitView {
    return this.army.spawn(side, kind, tx, ty);
  }

  /** Ticks before the stump `objectId` is cleared away; 0 when it is not a stump. */
  public stumpTicksLeft(objectId: number): number {
    return this.stumps.ticksLeft(objectId);
  }

  /** The hit points of the standing building `objectId`; null for trees, stumps and unknown ids. */
  public buildingHitPoints(objectId: number): HitPoints | null {
    return this.structures.hitPoints(objectId);
  }

  /** Rounds of wood already taken from the standing tree `objectId`; 0 for an untouched tree or any other id. */
  public treeChopsTaken(objectId: number): number {
    return this.felling.chopsTaken(objectId);
  }

  /** All peasants in ascending id order. */
  public peasants(): Iterable<PeasantView> {
    return this.populace.peasants();
  }

  /** How many workers there are and the worker limit the homes give. */
  public get population(): PopulationSummary {
    return { count: this.populace.count, housing: this.populace.housing };
  }

  /** What the production building `objectId` and its worker are doing; null for non-producers and unknown ids. */
  public productionState(objectId: number): ProductionState | null {
    return this.populace.withJobStatus(objectId, this.production.state(objectId));
  }

  /** Ticks the production building `objectId` is still skipped by job assignment (its worker could not reach it). */
  public jobSkipTicks(objectId: number): number {
    return this.populace.jobSkipTicks(objectId);
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

  /** Whether a walker on the ground may stand on tile (tx, ty): inside the map, not water, and free or under a tree, stump, gate or stairs. */
  public isWalkable(tx: number, ty: number): boolean {
    return this.index.isWalkable(tx, ty);
  }

  /** What tile (tx, ty) is to a walker: blocked, ground, stairs or a wall-walk top (see `canStep`). */
  public walkClass(tx: number, ty: number): WalkClass {
    return this.index.walkClass(tx, ty);
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
    return this.lifecycle.canPlace(kind, tx, ty);
  }

  /**
   * What a `placeWallLine` command from `from` to `to` would build now: its tiles, which get a piece, and the cost.
   * Changes nothing; the command builds exactly these pieces. Call per frame for the drag ghost.
   */
  public previewWallLine(from: TileCoord, to: TileCoord): WallLinePreview {
    return this.walls.preview(from, to);
  }

  /** Executes a player command. On failure, including a malformed command, nothing changes and no listener is called. */
  public apply(command: ObjectCommand): ObjectCommandResult;
  public apply(command: WorldCommand): CommandResult;
  public apply(command: WorldCommand): CommandResult {
    switch (command.type) {
      case 'placeBuilding': return this.lifecycle.placeBuilding(command.kind, command.tx, command.ty);
      case 'demolish': return this.lifecycle.demolish(command.objectId);
      case 'placeWallLine': return this.walls.build(command);
      case 'trainUnit': return this.army.train(command);
      case 'orderMove':
      case 'orderAttack':
        return this.army.order(command);
      default: return { ok: false, reason: 'UnknownCommand' };
    }
  }

  /**
   * Adds an object without the building rules (buildable, terrain, slope, cost). For the map generator only;
   * throws a RangeError when the kind is unknown or the footprint is outside the map or occupied.
   */
  public spawn(kind: ObjectKind, tx: number, ty: number): MapObject {
    return this.lifecycle.spawn(kind, tx, ty);
  }

  /** Calls `listener` for every object added or removed, and every tree chopped, from now on. Returns a function that unsubscribes it. */
  public onChange(listener: (change: WorldChange) => void): () => void {
    return this.listeners.add(listener);
  }
}
