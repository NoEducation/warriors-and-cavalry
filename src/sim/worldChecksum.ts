// Cheap fingerprint of a whole world, for comparing worlds (e.g. between peers).
import type { World } from './World';

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * 32-bit FNV-1a over the bytes of the map's `heights` and `tiles`, then each object's id, kind, tx and ty
 * (as little-endian int32) in id order. Use to compare worlds cheaply, e.g. between peers.
 */
export function worldChecksum(world: World): number {
  const { heights, tiles } = world.map;
  let hash = feedBytes(FNV_OFFSET_BASIS, new Uint8Array(heights.buffer, heights.byteOffset, heights.byteLength));
  hash = feedBytes(hash, tiles);
  for (const object of world.objects()) {
    hash = feedInt32(hash, object.id);
    hash = feedInt32(hash, object.kind);
    hash = feedInt32(hash, object.tx);
    hash = feedInt32(hash, object.ty);
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
