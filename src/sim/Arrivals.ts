// Housing and arrivals: how many peasants the buildings house, and when and where the next one arrives at the Keep.
import type { Economy } from './Economy';
import type { MapObject } from './MapObject';
import { OBJECT_KINDS, ObjectKind } from './ObjectKind';
import type { PopulationHost } from './PopulationHost';
import { POPULATION_CONFIG } from './populationConfig';
import { ResourceKind, resources } from './ResourceKind';
import type { TileCoord } from './TileCoord';

const ARRIVAL_COST = resources(0, 0, POPULATION_CONFIG.arrivalFoodCost);

export class Arrivals {
  /** Standing buildings that house peasants, by id (ascending). */
  private readonly homes = new Map<number, MapObject>();
  private totalHousing = 0;
  private timer = 0;

  /** Arrivals in `world`, paid for from `economy`. */
  public constructor(private readonly world: PopulationHost, private readonly economy: Economy) {}

  /** Peasants the standing buildings can house. */
  public get housing(): number {
    return this.totalHousing;
  }

  /** Ticks counted toward the next arrival; 0 while nobody can arrive. */
  public get arrivalTimer(): number {
    return this.timer;
  }

  /** The lowest-id Keep, where peasants arrive and idle ones gather; null without one. */
  public get keep(): MapObject | null {
    for (const home of this.homes.values()) if (home.kind === ObjectKind.Keep) return home;
    return null;
  }

  /** Call for every object added to the world: counts its housing. */
  public buildingAdded(object: MapObject): void {
    const { housing } = OBJECT_KINDS[object.kind];
    if (housing === 0) return;
    this.homes.set(object.id, object);
    this.totalHousing += housing;
  }

  /** Call for every object removed from the world: drops its housing. */
  public buildingRemoved(object: MapObject): void {
    if (this.homes.delete(object.id)) this.totalHousing -= OBJECT_KINDS[object.kind].housing;
  }

  /**
   * Counts toward the next arrival while `population` is below the housing, there is food and a free tile at the
   * Keep; resets otherwise. Returns the tile a peasant arrives on this tick (its food already paid), else null.
   */
  public tick(population: number): TileCoord | null {
    const canArrive =
      population < this.totalHousing && this.economy.amount(ResourceKind.Food) >= POPULATION_CONFIG.arrivalFoodCost;
    const tile = canArrive ? this.arrivalTile() : null;
    if (!tile) {
      this.timer = 0;
      return null;
    }
    if (++this.timer < POPULATION_CONFIG.arrivalTicks) return null;
    this.economy.spend(ARRIVAL_COST);
    this.timer = 0;
    return tile;
  }

  /**
   * The first access tile of the lowest-id Keep in the order: bottom edge left to right, right edge top to bottom,
   * top edge left to right, left edge top to bottom; null without a Keep or a free tile around it.
   */
  private arrivalTile(): TileCoord | null {
    const keep = this.keep;
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
}
