// Cheap fingerprint of a whole world, for comparing worlds (e.g. between peers).
import { RESOURCE_KINDS } from './ResourceKind';
import type { World } from './World';

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * 32-bit FNV-1a over the bytes of the map's `heights` and `tiles`, then (as little-endian int32) the tick count,
 * each resource's amount and capacity in `RESOURCE_KINDS` order, each object's id, kind, tx and ty in id order,
 * and each producing building's cycle progress in id order. Use to compare worlds cheaply, e.g. between peers.
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
  return hash >>> 0;
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
