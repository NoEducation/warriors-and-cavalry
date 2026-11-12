// The simulation state: a map plus the objects standing on it, changed only through commands.
import { Footprint } from './Footprint';
import type { GameMap } from './GameMap';
import type { MapObject } from './MapObject';
import { OBJECT_KINDS, type ObjectKind, type ObjectKindInfo } from './ObjectKind';
import { TileType } from './tiles';
import type { CommandResult, PlacementCheck, WorldChange, WorldCommand } from './WorldCommand';

/** Largest allowed difference between the highest and lowest corner under a building's footprint. */
export const MAX_FOOTPRINT_SLOPE = 0.6;
/** Heights are stored as float32, so a range of exactly MAX_FOOTPRINT_SLOPE can read slightly above it. */
const SLOPE_TOLERANCE = 1e-5;

export class World {
  public readonly map: GameMap;
  /** Object id per tile (index ty*width+tx); 0 means free. */
  private readonly occupancy: Int32Array;
  /** Ids only increase and are never reused, so insertion order is ascending id order. */
  private readonly byId = new Map<number, MapObject>();
  private readonly listeners = new Set<(change: WorldChange) => void>();
  private nextId = 1;
  private ticks = 0;

  /** Creates a world with no objects on `map`. */
  public constructor(map: GameMap) {
    this.map = map;
    this.occupancy = new Int32Array(map.width * map.height);
  }

  /** Number of simulation ticks run since the world was generated. */
  public get tickCount(): number {
    return this.ticks;
  }

  /** Advances the world by one simulation tick. Called by the game loop as many times as the runner says. */
  public tick(): void {
    this.ticks++;
  }

  /** Number of objects currently in the world. */
  public get objectCount(): number {
    return this.byId.size;
  }

  /** The object covering tile (tx, ty), or undefined when the tile is free or outside the map. */
  public objectAt(tx: number, ty: number): MapObject | undefined {
    if (!this.map.inBounds(tx, ty)) return undefined;
    const id = this.occupancy[ty * this.map.width + tx];
    return id === 0 ? undefined : this.byId.get(id);
  }

  /** All objects in ascending id order. Do not add or remove objects while iterating. */
  public objects(): Iterable<MapObject> {
    return this.byId.values();
  }

  /**
   * Whether a building of `kind` may be placed with its footprint starting at (tx, ty); the first failing rule wins.
   * An unknown `kind` is reported as NotBuildable.
   */
  public canPlace(kind: ObjectKind, tx: number, ty: number): PlacementCheck {
    const info: ObjectKindInfo | undefined = OBJECT_KINDS[kind];
    if (!info?.buildable) return { ok: false, reason: 'NotBuildable' };
    const footprint = Footprint.of(kind, tx, ty);
    if (!footprint.inBounds(this.map)) return { ok: false, reason: 'OutOfBounds' };
    for (const tile of footprint.tiles()) {
      const type = this.map.tileAt(tile.tx, tile.ty);
      if (type !== TileType.Grass && type !== TileType.Sand) return { ok: false, reason: 'BadTerrain' };
    }
    if (!this.isFree(footprint)) return { ok: false, reason: 'Occupied' };
    const range = footprint.cornerHeightRange(this.map);
    if (!range || range.max - range.min > MAX_FOOTPRINT_SLOPE + SLOPE_TOLERANCE) {
      return { ok: false, reason: 'TooSteep' };
    }
    return { ok: true };
  }

  /** Executes a player command. On failure, including a malformed command, nothing changes and no listener is called. */
  public apply(command: WorldCommand): CommandResult {
    switch (command.type) {
      case 'placeBuilding': {
        const check = this.canPlace(command.kind, command.tx, command.ty);
        if (!check.ok) return check;
        return { ok: true, object: this.add(command.kind, command.tx, command.ty) };
      }
      case 'demolish':
        return this.demolish(command.objectId);
      default:
        return { ok: false, reason: 'UnknownCommand' };
    }
  }

  /**
   * Adds an object without the building rules (buildable, terrain, slope). For the map generator only;
   * throws a RangeError when the kind is unknown or the footprint is outside the map or occupied.
   */
  public spawn(kind: ObjectKind, tx: number, ty: number): MapObject {
    const footprint = Footprint.of(kind, tx, ty);
    if (!footprint.inBounds(this.map)) throw new RangeError(`footprint at (${tx}, ${ty}) out of bounds`);
    if (!this.isFree(footprint)) throw new RangeError(`footprint at (${tx}, ${ty}) occupied`);
    return this.add(kind, tx, ty);
  }

  /** Calls `listener` for every object added or removed from now on. Returns a function that unsubscribes it. */
  public onChange(listener: (change: WorldChange) => void): () => void {
    const wrapped = (change: WorldChange): void => listener(change);
    this.listeners.add(wrapped);
    return (): void => {
      this.listeners.delete(wrapped);
    };
  }

  private demolish(objectId: number): CommandResult {
    const object = this.byId.get(objectId);
    if (!object) return { ok: false, reason: 'UnknownObject' };
    if (!OBJECT_KINDS[object.kind].buildable) return { ok: false, reason: 'NotDemolishable' };
    this.fill(Footprint.of(object.kind, object.tx, object.ty), 0);
    this.byId.delete(objectId);
    this.notify({ type: 'removed', object });
    return { ok: true, object };
  }

  private add(kind: ObjectKind, tx: number, ty: number): MapObject {
    const object: MapObject = Object.freeze({ id: this.nextId++, kind, tx, ty });
    this.byId.set(object.id, object);
    this.fill(Footprint.of(kind, tx, ty), object.id);
    this.notify({ type: 'added', object });
    return object;
  }

  /** Assumes the footprint is in bounds. */
  private isFree(footprint: Footprint): boolean {
    for (const tile of footprint.tiles()) {
      if (this.occupancy[tile.ty * this.map.width + tile.tx] !== 0) return false;
    }
    return true;
  }

  /** Writes `id` (0 frees) into every tile of an in-bounds footprint. */
  private fill(footprint: Footprint, id: number): void {
    for (const tile of footprint.tiles()) this.occupancy[tile.ty * this.map.width + tile.tx] = id;
  }

  private notify(change: WorldChange): void {
    for (const listener of [...this.listeners]) listener(change);
  }
}
