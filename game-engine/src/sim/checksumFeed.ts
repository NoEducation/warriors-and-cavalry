// The FNV-1a steps the world checksum is built from: bytes, little-endian int32s and lists of tiles.
import type { TileCoord } from './TileCoord';

export const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Feeds every byte of `bytes`. */
export function feedBytes(hash: number, bytes: Uint8Array): number {
  for (let i = 0; i < bytes.length; i++) hash = feedByte(hash, bytes[i]);
  return hash;
}

/** Feeds the four bytes of `value` as a little-endian int32. */
export function feedInt32(hash: number, value: number): number {
  for (let shift = 0; shift < 32; shift += 8) hash = feedByte(hash, (value >>> shift) & 0xff);
  return hash;
}

/** Feeds the number of `tiles` from index `from` on, then each one's tx and ty. */
export function feedTiles(hash: number, tiles: readonly TileCoord[], from: number): number {
  hash = feedInt32(hash, tiles.length - from);
  for (let i = from; i < tiles.length; i++) hash = feedInt32(feedInt32(hash, tiles[i].tx), tiles[i].ty);
  return hash;
}

function feedByte(hash: number, byte: number): number {
  return Math.imul(hash ^ byte, FNV_PRIME);
}
