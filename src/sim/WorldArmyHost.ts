// The world as its army sees it: the world's read-only questions plus the damage the army may deal.
import type { ArmyHost } from './ArmyHost';
import type { Economy } from './Economy';
import type { MapObject } from './MapObject';
import type { PeasantView } from './PeasantView';
import type { Population } from './Population';
import type { Structures } from './Structures';
import type { TileCoord } from './TileCoord';
import type { WalkClass } from './walkRules';
import type { World } from './World';

/** The parts of a world the army's damage goes to. */
export interface ArmyTargets {
  readonly economy: Economy;
  readonly structures: Structures;
  readonly population: Population;
  /** Removes a building without a refund (see `ObjectLifecycle.remove`). */
  readonly destroy: (object: MapObject) => void;
}

export class WorldArmyHost implements ArmyHost {
  public readonly economy: Economy;

  /** The army's view of `world`, dealing damage to `targets`. Create once per world. */
  public constructor(private readonly world: World, private readonly targets: ArmyTargets) {
    this.economy = targets.economy;
  }

  public get map(): World['map'] { return this.world.map; }
  public get tickCount(): number { return this.world.tickCount; }

  /** See `World.isWalkable`. */
  public isWalkable(tx: number, ty: number): boolean { return this.world.isWalkable(tx, ty); }
  /** See `World.walkClass`. */
  public walkClass(tx: number, ty: number): WalkClass { return this.world.walkClass(tx, ty); }
  /** See `World.accessTiles`. */
  public accessTiles(objectId: number): TileCoord[] { return this.world.accessTiles(objectId); }
  /** See `World.objectById`. */
  public objectById(id: number): MapObject | undefined { return this.world.objectById(id); }
  /** See `World.objectAt`. */
  public objectAt(tx: number, ty: number): MapObject | undefined { return this.world.objectAt(tx, ty); }
  /** See `World.objects`. */
  public objects(): Iterable<MapObject> { return this.world.objects(); }
  /** See `World.treeChopsTaken`. */
  public treeChopsTaken(objectId: number): number { return this.world.treeChopsTaken(objectId); }
  /** See `World.peasants`. */
  public peasants(): Iterable<PeasantView> { return this.targets.population.peasants(); }
  /** The peasant `id`, or undefined. */
  public peasantById(id: number): PeasantView | undefined { return this.targets.population.peasantById(id); }

  /** Takes `amount` hit points from peasant `id`. */
  public damagePeasant(id: number, amount: number): void {
    this.targets.population.damage(id, amount);
  }

  /** Takes `amount` hit points from building `id`; one that falls is removed without a refund. True when it fell. */
  public damageBuilding(id: number, amount: number): boolean {
    const object = this.world.objectById(id);
    if (!object || !this.targets.structures.damage(id, amount)) return false;
    this.targets.destroy(object);
    return true;
  }

  /** True when `id` is a standing building that can be attacked. */
  public isAttackable(id: number): boolean {
    return this.targets.structures.has(id);
  }

  /** Removes the peasants killed this tick. */
  public removeDeadPeasants(): void {
    this.targets.population.removeDead();
  }
}
