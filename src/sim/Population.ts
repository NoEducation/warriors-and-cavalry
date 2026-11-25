// The camp's peasants: housing, arrivals at the Keep, leaving when housing drops, and walking found paths.
import type { Economy } from './Economy';
import type { GameMap } from './GameMap';
import type { MapObject } from './MapObject';
import { OBJECT_KINDS, ObjectKind } from './ObjectKind';
import { Peasant, type PeasantView } from './Peasant';
import type { IsWalkable } from './PathFinder';
import { PeasantWalker } from './PeasantWalker';
import { POPULATION_CONFIG } from './populationConfig';
import { ResourceKind, resources } from './ResourceKind';
import type { TileCoord } from './TileCoord';

/** What the population needs to know about the world it lives in. `World` is one. */
export interface PopulationHost {
  readonly map: GameMap;
  isWalkable: IsWalkable;
  accessTiles(objectId: number): TileCoord[];
  objectById(id: number): MapObject | undefined;
  objects(): Iterable<MapObject>;
}

/** Population totals for the UI. */
export interface PopulationSummary {
  readonly count: number;
  readonly housing: number;
  readonly idle: number;
}

const ARRIVAL_COST = resources(0, 0, POPULATION_CONFIG.arrivalFoodCost);

export class Population {
  /** Peasants by id; ids only increase, so insertion order is ascending id order. */
  private readonly byId = new Map<number, Peasant>();
  /** Standing buildings that house peasants, by id (ascending). */
  private readonly homes = new Map<number, MapObject>();
  private readonly walker: PeasantWalker;
  private totalHousing = 0;
  private timer = 0;
  private nextId = 1;

  /** Peasants living in `world`, paying for arrivals from `economy`. */
  public constructor(private readonly world: PopulationHost, private readonly economy: Economy) {
    const isWalkable = (tx: number, ty: number): boolean => world.isWalkable(tx, ty);
    this.walker = new PeasantWalker(world.map.width, world.map.height, isWalkable);
  }

  /** Number of peasants. */
  public get count(): number {
    return this.byId.size;
  }

  /** Peasants the standing buildings can house. */
  public get housing(): number {
    return this.totalHousing;
  }

  /** Number of peasants without anything to do. */
  public get idleCount(): number {
    let idle = 0;
    for (const p of this.byId.values()) if (p.state === 'idle') idle++;
    return idle;
  }

  /** Ticks counted toward the next arrival; 0 while nobody can arrive. */
  public get arrivalTimer(): number {
    return this.timer;
  }

  /** All peasants in ascending id order. */
  public peasants(): Iterable<PeasantView> {
    return this.byId.values();
  }

  /** Call for every object added to the world: counts its housing. */
  public buildingAdded(object: MapObject): void {
    const { housing } = OBJECT_KINDS[object.kind];
    if (housing === 0) return;
    this.homes.set(object.id, object);
    this.totalHousing += housing;
  }

  /** Call for every object removed from the world: drops its housing, and peasants leave until the rest fit. */
  public buildingRemoved(object: MapObject): void {
    if (!this.homes.delete(object.id)) return;
    this.totalHousing -= OBJECT_KINDS[object.kind].housing;
    this.leaveUntilHoused();
  }

  /** Advances one tick: arrivals and leaving, then every peasant's walk in ascending id order. */
  public tick(): void {
    this.arrive();
    this.leaveUntilHoused();
    for (const p of this.byId.values()) this.walker.tick(p);
  }

  /**
   * Sends `peasant` toward the nearest of `goals` along a found path, from the tile it stands on (or, mid-step, the
   * tile it is stepping onto). Returns false, and leaves it without a walk, when no goal is reachable. Internal to the
   * simulation: used by the job rules and by tests.
   */
  public walkTo(peasant: PeasantView, goals: readonly TileCoord[]): boolean {
    const p = this.byId.get(peasant.id);
    return p !== undefined && this.walker.walkTo(p, goals);
  }

  /** Counts toward the next arrival while there is housing, food and a free tile at the Keep; resets otherwise. */
  private arrive(): void {
    const canArrive =
      this.byId.size < this.totalHousing && this.economy.amount(ResourceKind.Food) >= POPULATION_CONFIG.arrivalFoodCost;
    const tile = canArrive ? this.arrivalTile() : null;
    if (!tile) {
      this.timer = 0;
      return;
    }
    if (++this.timer < POPULATION_CONFIG.arrivalTicks) return;
    this.economy.spend(ARRIVAL_COST);
    const peasant = new Peasant(this.nextId++, tile.tx, tile.ty);
    this.byId.set(peasant.id, peasant);
    this.timer = 0;
  }

  /**
   * The first access tile of the lowest-id Keep in the order: bottom edge left to right, right edge top to bottom,
   * top edge left to right, left edge top to bottom; null without a Keep or a free tile around it.
   */
  private arrivalTile(): TileCoord | null {
    let keep: MapObject | undefined;
    for (const home of this.homes.values()) if (!keep && home.kind === ObjectKind.Keep) keep = home;
    if (!keep) return null;
    const { width, height } = OBJECT_KINDS[keep.kind];
    const span = this.world.map.width + this.world.map.height;
    let best: TileCoord | null = null;
    let bestKey = Infinity;
    for (const tile of this.world.accessTiles(keep.id)) {
      let key: number;
      if (tile.ty === keep.ty + height) key = tile.tx;
      else if (tile.tx === keep.tx + width) key = span + tile.ty;
      else if (tile.ty === keep.ty - 1) key = 2 * span + tile.tx;
      else key = 3 * span + tile.ty;
      if (key < bestKey) [best, bestKey] = [tile, key];
    }
    return best;
  }

  /** While there are more peasants than housing, removes idle ones by highest id first, then the rest likewise. */
  private leaveUntilHoused(): void {
    const excess = this.byId.size - this.totalHousing;
    if (excess <= 0) return;
    const newestFirst = [...this.byId.values()].reverse();
    const idle = newestFirst.filter((p) => p.state === 'idle');
    const idleFirst = [...idle, ...newestFirst.filter((p) => p.state !== 'idle')];
    for (const p of idleFirst.slice(0, excess)) this.byId.delete(p.id);
  }
}
