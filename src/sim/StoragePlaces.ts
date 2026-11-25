// The standing storage places (Keeps, Stockpiles, Granaries) and which of them take a resource.
import type { MapObject } from './MapObject';
import { OBJECT_KINDS, ObjectKind } from './ObjectKind';
import type { PopulationHost } from './PopulationHost';
import { RESOURCE_KINDS, type ResourceKind } from './ResourceKind';
import type { TileCoord } from './TileCoord';

/** A storage place a carrier may head for, with its access tiles. */
export interface StoreCandidate {
  readonly id: number;
  readonly tiles: readonly TileCoord[];
}

/** True when a building of `kind` takes deliveries of `resource`: the Keep takes all, others what they hold. */
function storesResource(kind: ObjectKind, resource: ResourceKind): boolean {
  return kind === ObjectKind.Keep || OBJECT_KINDS[kind].storage[resource] > 0;
}

export class StoragePlaces {
  /** Standing storage places by id (ascending). */
  private readonly stores = new Map<number, MapObject>();

  /** The storage places of `world`. */
  public constructor(private readonly world: PopulationHost) {}

  /** Call for every object added to the world: remembers a storage place. */
  public buildingAdded(object: MapObject): void {
    if (RESOURCE_KINDS.some((resource) => storesResource(object.kind, resource))) this.stores.set(object.id, object);
  }

  /** Call for every object removed from the world: forgets a storage place. */
  public buildingRemoved(object: MapObject): void {
    this.stores.delete(object.id);
  }

  /** Whether `id` is a standing storage place. */
  public has(id: number | null): boolean {
    return id !== null && this.stores.has(id);
  }

  /** Whether any storage place takes `resource`. */
  public anyFor(resource: ResourceKind): boolean {
    for (const store of this.stores.values()) if (storesResource(store.kind, resource)) return true;
    return false;
  }

  /** Every storage place taking `resource`, in ascending id order, with its access tiles. */
  public candidatesFor(resource: ResourceKind): StoreCandidate[] {
    const candidates: StoreCandidate[] = [];
    for (const store of this.stores.values()) {
      if (storesResource(store.kind, resource)) candidates.push({ id: store.id, tiles: this.world.accessTiles(store.id) });
    }
    return candidates;
  }
}
