// Cheap fingerprint of a whole world, for comparing worlds (e.g. between peers).
import { PEASANT_STATES, type PeasantView } from './Peasant';
import { RESOURCE_KINDS } from './ResourceKind';
import type { TileCoord } from './TileCoord';
import type { World } from './World';

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * 32-bit FNV-1a over the bytes of the map's `heights` and `tiles`, then (as little-endian int32) the tick count,
 * each resource's amount and capacity in `RESOURCE_KINDS` order, each object's id, kind, tx and ty in id order,
 * each producing building's cycle progress in id order, the id and remaining skip ticks of each building skipped by
 * job assignment in id order, the arrival timer, and each peasant in id order (see `feedPeasant`).
 * Use to compare worlds cheaply, e.g. between peers.
 */
export function worldChecksum(world: World): number {
  const { heights, tiles } = world.map;
  let hash = feedBytes(FNV_OFFSET_BASIS, new Uint8Array(heights.buffer, heights.byteOffset, heights.byteLength));
  hash = feedBytes(hash, tiles);
  hash = feedInt32(hash, world.tickCount);
  for (const kind of RESOURCE_KINDS) {
    hash = feedInt32(hash, world.economy.amount(kind));
    hash = feedInt32(hash, world.economy.capacity(kind));
  }
  for (const object of world.objects()) {
    hash = feedInt32(hash, object.id);
    hash = feedInt32(hash, object.kind);
    hash = feedInt32(hash, object.tx);
    hash = feedInt32(hash, object.ty);
  }
  for (const object of world.objects()) {
    const production = world.productionState(object.id);
    if (production) hash = feedInt32(hash, production.progress);
  }
  for (const object of world.objects()) {
    const skip = world.jobSkipTicks(object.id);
    if (skip > 0) hash = feedInt32(feedInt32(hash, object.id), skip);
  }
  hash = feedInt32(hash, world.arrivalTimer);
  for (const p of world.peasants()) hash = feedPeasant(hash, p);
  return hash >>> 0;
}

/**
 * Everything a later tick reads of peasant `p`: id, state index, tx, ty, nextTx, nextTy, step progress, step ticks,
 * load resource (-1 for none) and amount, workplace id (0 for none), delivery target id (0 for none), wait ticks,
 * path index, the tiles still ahead on its path (count, then each tx and ty) and its walk's goal tiles (likewise).
 */
function feedPeasant(hash: number, p: PeasantView): number {
  hash = feedInt32(hash, p.id);
  hash = feedInt32(hash, PEASANT_STATES.indexOf(p.state));
  hash = feedInt32(hash, p.tx);
  hash = feedInt32(hash, p.ty);
  hash = feedInt32(hash, p.nextTx);
  hash = feedInt32(hash, p.nextTy);
  hash = feedInt32(hash, p.stepProgress);
  hash = feedInt32(hash, p.stepTicks);
  hash = feedInt32(hash, p.load ? p.load.resource : -1);
  hash = feedInt32(hash, p.load ? p.load.amount : 0);
  hash = feedInt32(hash, p.workplaceId ?? 0);
  hash = feedInt32(hash, p.targetId ?? 0);
  hash = feedInt32(hash, p.waitTicks);
  hash = feedInt32(hash, p.pathIndex);
  hash = feedTiles(hash, p.path, p.pathIndex);
  return feedTiles(hash, p.goals, 0);
}

/** Feeds the number of `tiles` from `from` on, then each one's tx and ty. */
function feedTiles(hash: number, tiles: readonly TileCoord[], from: number): number {
  hash = feedInt32(hash, tiles.length - from);
  for (let i = from; i < tiles.length; i++) hash = feedInt32(feedInt32(hash, tiles[i].tx), tiles[i].ty);
  return hash;
}

function feedBytes(hash: number, bytes: Uint8Array): number {
  for (let i = 0; i < bytes.length; i++) hash = feedByte(hash, bytes[i]);
  return hash;
}

/** Feeds the four bytes of `value` as a little-endian int32. */
function feedInt32(hash: number, value: number): number {
  for (let shift = 0; shift < 32; shift += 8) hash = feedByte(hash, (value >>> shift) & 0xff);
  return hash;
}

function feedByte(hash: number, byte: number): number {
  return Math.imul(hash ^ byte, FNV_PRIME);
}
