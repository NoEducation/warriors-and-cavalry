// Housing: how many workers the homes allow (the worker limit), and where at the Keep a new worker appears.
import type { MapObject } from './MapObject';
import { firstAccessTile } from './accessOrder';
import { OBJECT_KINDS, ObjectKind } from './ObjectKind';
import type { PopulationHost } from './PopulationHost';
import type { TileCoord } from './TileCoord';

export class Housing {
  /** Standing buildings that house peasants, by id (ascending). */
  private readonly homes = new Map<number, MapObject>();
  private totalHousing = 0;

  /** Housing in `world`. */
  public constructor(private readonly world: PopulationHost) {}

  /** The worker limit: peasants the standing buildings house. Rises and drops the moment a home is added or removed. */
  public get housing(): number {
    return this.totalHousing;
  }

  /** The lowest-id Keep, where new workers appear; null without one. */
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
   * Where a new worker appears: the first access tile of the lowest-id Keep in the order bottom edge left to right,
   * right edge top to bottom, top edge left to right, left edge top to bottom; null without a Keep or a free tile.
   */
  public spawnTile(): TileCoord | null {
    const keep = this.keep;
    return keep ? firstAccessTile(this.world, keep) : null;
  }
}
