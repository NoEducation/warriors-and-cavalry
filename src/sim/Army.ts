// Every soldier and raider: training at the Barracks, their orders, and one tick of fighting.
import { firstAccessTile } from './accessOrder';
import type { ArmyHost } from './ArmyHost';
import { ArmyOrders } from './ArmyOrders';
import { Battlefield } from './Battlefield';
import { Breach } from './Breach';
import type { MapObject } from './MapObject';
import { OBJECT_KINDS, ObjectKind } from './ObjectKind';
import { RaidSchedule, type RaidView, waveArchers, waveSize } from './RaidSchedule';
import { RaidSpawner } from './RaidSpawner';
import { RaiderBrain } from './RaiderBrain';
import { SoldierBrain } from './SoldierBrain';
import { StepWalker } from './StepWalker';
import { Training, type TrainingQueueView } from './Training';
import { Unit } from './Unit';
import { isUnitKind, Side, UnitKind, UNIT_KINDS } from './UnitKind';
import type { UnitView } from './UnitView';
import { UnitWalks } from './UnitWalks';
import type { CommandFailure, OrderCommand, OrderSuccess, TrainUnitCommand, TrainUnitSuccess } from './WorldCommand';

/** Soldier totals for the UI: living player soldiers, and the room the Barracks give. */
export interface SoldierSummary {
  readonly count: number;
  readonly room: number;
}

export class Army {
  /** Units by id; ids only increase, so insertion order is ascending id order. */
  private readonly byId = new Map<number, Unit>();
  private readonly training = new Training();
  private readonly orders: ArmyOrders;
  private readonly soldierBrain: SoldierBrain;
  private readonly raiderBrain: RaiderBrain;
  /** Standing buildings raiders may attack, by id (ascending). */
  private readonly buildings = new Map<number, MapObject>();
  private readonly raids = new RaidSchedule();
  private readonly spawner: RaidSpawner;
  /** True while a raider's strike is wrecking a building, so the loss of the last Keep counts as a defeat. */
  private wrecking = false;
  private nextId = 1;

  /** The army of `world`. Create once per world. */
  public constructor(private readonly world: ArmyHost) {
    const walker = new StepWalker(world.map.width, world.map.height, (tx, ty) => world.walkClass(tx, ty));
    const field = new Battlefield(world, this.byId, (id, amount) => this.wreck(id, amount));
    const walks = new UnitWalks(world, walker, field);
    this.orders = new ArmyOrders(world, this.byId);
    this.soldierBrain = new SoldierBrain(field, walks);
    const ground = { units: this.byId, buildings: this.buildings };
    const breach = new Breach(world, walker);
    this.raiderBrain = new RaiderBrain(field, walks, breach, ground);
    this.spawner = new RaidSpawner(world, walks.raiderWalkClass, breach);
  }

  /** Every unit in ascending id order (dead ones only until the end of the tick that killed them). */
  public units(): Iterable<UnitView> {
    return this.byId.values();
  }

  /** The unit `id`, or undefined. */
  public unitById(id: number): UnitView | undefined {
    return this.byId.get(id);
  }

  /** The id the next unit will get; for the checksum. */
  public get nextUnitId(): number {
    return this.nextId;
  }

  /** Living player soldiers and the room the Barracks give. */
  public get soldiers(): SoldierSummary {
    return { count: this.playerSoldiers(), room: this.training.room };
  }

  /** The queue of Barracks `objectId`; null when it is not a standing Barracks. */
  public trainingQueue(objectId: number): TrainingQueueView | null {
    return this.training.queue(objectId);
  }

  /** Every Barracks' queue in ascending id order; for the checksum. */
  public trainingQueues(): Iterable<readonly [number, TrainingQueueView]> {
    return this.training.all();
  }

  /** Call for every object added to the world. */
  public buildingAdded(object: MapObject): void {
    if (OBJECT_KINDS[object.kind].hitPoints > 0) this.buildings.set(object.id, object);
    if (object.kind === ObjectKind.Keep) this.raids.keepBuilt();
    this.training.buildingAdded(object);
  }

  /** Call for every object removed from the world. */
  public buildingRemoved(object: MapObject): void {
    this.buildings.delete(object.id);
    if (object.kind === ObjectKind.Keep && !this.keep()) this.raids.keepLost(this.wrecking);
    this.training.buildingRemoved(object);
  }

  /** Adds a unit without any rule or cost; for setting up worlds (tests, scenarios). */
  public spawn(side: Side, kind: UnitKind, tx: number, ty: number): Unit {
    const unit = new Unit(this.nextId++, side, kind, tx, ty);
    this.byId.set(unit.id, unit);
    return unit;
  }

  /** Pays for a soldier and queues it at a Barracks; see `WorldCommand` `trainUnit` for the failures. */
  public train(command: TrainUnitCommand): TrainUnitSuccess | CommandFailure {
    const { barracksId, unitKind } = command;
    if (!this.world.objectById(barracksId)) return { ok: false, reason: 'UnknownObject' };
    if (!this.training.isBarracks(barracksId)) return { ok: false, reason: 'NotABarracks' };
    if (!isUnitKind(unitKind)) return { ok: false, reason: 'UnknownUnitKind' };
    if (!this.training.hasQueueRoom(barracksId)) return { ok: false, reason: 'QueueFull' };
    if (this.playerSoldiers() + this.training.queued >= this.training.room) return { ok: false, reason: 'NoSoldierRoom' };
    if (!this.world.economy.spend(UNIT_KINDS[unitKind].cost)) return { ok: false, reason: 'NotEnoughResources' };
    return { ok: true, queued: this.training.enqueue(barracksId, unitKind) };
  }

  /** Gives player soldiers a `move` or `attack` order; see `ArmyOrders.apply`. */
  public order(command: OrderCommand): OrderSuccess | CommandFailure {
    return this.orders.apply(command);
  }

  /** The raid timer, the Keep's fall and the raiders alive. */
  public get raidView(): RaidView {
    let raidersAlive = 0;
    for (const unit of this.byId.values()) if (unit.side === Side.Raider && unit.alive) raidersAlive++;
    const { wave, ticksToNextWave, keepFallen } = this.raids;
    return { wave, ticksToNextWave, keepFallen, raidersAlive };
  }

  /**
   * Advances one tick: training, the raid timer (a due wave appears), then every living unit in ascending id order,
   * then the dead are removed.
   */
  public tick(): void {
    this.training.tick((barracks, kind) => this.stepOut(barracks, kind));
    const wave = this.raids.tick();
    if (wave > 0) this.sendWave(wave);
    for (const unit of this.byId.values()) {
      if (!unit.alive) continue;
      unit.countDown();
      if (unit.side === Side.Player) this.soldierBrain.tick(unit);
      else this.raiderBrain.tick(unit);
    }
    this.removeDead();
  }

  /** Wave `wave` appears on its spawn tile, Spearmen first, then Archers; skipped when the Keep has none. */
  private sendWave(wave: number): void {
    const keep = this.keep();
    const tile = keep ? this.spawner.tileFor(keep, wave) : null;
    if (!tile) return;
    const archers = waveArchers(wave);
    const size = waveSize(wave);
    for (let i = 0; i < size; i++) this.spawn(Side.Raider, i < size - archers ? UnitKind.Spearman : UnitKind.Archer, tile.tx, tile.ty);
  }

  /** The lowest-id standing Keep, or null. */
  private keep(): MapObject | null {
    for (const building of this.buildings.values()) if (building.kind === ObjectKind.Keep) return building;
    return null;
  }

  /** A raider's strike on building `id`: a Keep it wrecks this way counts as fallen. */
  private wreck(id: number, amount: number): void {
    this.wrecking = true;
    try {
      this.world.damageBuilding(id, amount);
    } finally {
      this.wrecking = false;
    }
  }

  /** A finished soldier steps out on the Barracks' first free access tile; false when there is none. */
  private stepOut(barracks: MapObject, kind: UnitKind): boolean {
    const tile = firstAccessTile(this.world, barracks);
    if (!tile) return false;
    this.spawn(Side.Player, kind, tile.tx, tile.ty);
    return true;
  }

  /** Removes the units and peasants killed this tick, in ascending id order. */
  private removeDead(): void {
    for (const unit of this.byId.values()) if (!unit.alive) this.byId.delete(unit.id);
    this.world.removeDeadPeasants();
  }

  private playerSoldiers(): number {
    let count = 0;
    for (const unit of this.byId.values()) if (unit.side === Side.Player && unit.alive) count++;
    return count;
  }
}
