// Every soldier and raider: training at the Barracks, their orders, and one tick of fighting.
import { firstAccessTile } from './accessOrder';
import type { ArmyHost } from './ArmyHost';
import type { MapObject } from './MapObject';
import { Training, type TrainingQueueView } from './Training';
import { Unit } from './Unit';
import { isUnitKind, Side, type UnitKind, UNIT_KINDS } from './UnitKind';
import type { UnitView } from './UnitView';
import type { CommandFailure, TrainUnitCommand, TrainUnitSuccess } from './WorldCommand';

/** Soldier totals for the UI: living player soldiers, and the room the Barracks give. */
export interface SoldierSummary {
  readonly count: number;
  readonly room: number;
}

export class Army {
  /** Units by id; ids only increase, so insertion order is ascending id order. */
  private readonly byId = new Map<number, Unit>();
  private readonly training = new Training();
  private nextId = 1;

  /** The army of `world`. Create once per world. */
  public constructor(private readonly world: ArmyHost) {}

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
    this.training.buildingAdded(object);
  }

  /** Call for every object removed from the world. */
  public buildingRemoved(object: MapObject): void {
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

  /** Advances one tick: training, then every living unit in ascending id order, then the dead are removed. */
  public tick(): void {
    this.training.tick((barracks, kind) => this.stepOut(barracks, kind));
    this.removeDead();
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
