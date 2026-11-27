// Shared set-up for the combat tests: flat maps, placing buildings and running ticks.
import { Economy } from '../src/sim/Economy';
import { GameMap } from '../src/sim/GameMap';
import type { MapObject } from '../src/sim/MapObject';
import type { ObjectKind } from '../src/sim/ObjectKind';
import { type ResourceAmounts, resources } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';

/** A flat grass world `size` tiles square holding `start` (by default 100 of each resource); tiles `water` holds are water. */
export function combatWorld(
  size = 32,
  water: (tx: number, ty: number) => boolean = () => false,
  seed = 1,
  start: ResourceAmounts = resources(100, 100, 100),
): World {
  const tiles = new Uint8Array(size * size).fill(TileType.Grass);
  for (let ty = 0; ty < size; ty++) for (let tx = 0; tx < size; tx++) if (water(tx, ty)) tiles[ty * size + tx] = TileType.Water;
  const map = new GameMap(size, size, seed, new Float32Array((size + 1) * (size + 1)), tiles);
  return new World(map, new Economy(start));
}

/** Places a building through a command, throwing when it fails. */
export function place(world: World, kind: ObjectKind, tx: number, ty: number): MapObject {
  const result = world.apply({ type: 'placeBuilding', kind, tx, ty });
  if (!result.ok) throw new Error(`placement failed: ${result.reason}`);
  return result.object;
}

/** Runs `n` ticks. */
export function run(world: World, n: number): void {
  for (let i = 0; i < n; i++) world.tick();
}

/** Runs ticks until `done` holds, at most `limit`; returns the ticks run, or throws when it never holds. */
export function runUntil(world: World, done: () => boolean, limit = 5000): number {
  for (let i = 0; i < limit; i++) {
    if (done()) return i;
    world.tick();
  }
  if (done()) return limit;
  throw new Error(`condition not reached in ${limit} ticks`);
}
