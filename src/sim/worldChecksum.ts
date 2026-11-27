// Cheap fingerprint of a whole world, for comparing worlds (e.g. between peers).
import { feedArmy } from './armyChecksum';
import { feedInt32, feedTiles } from './checksumFeed';
import { PEASANT_STATES, type PeasantView } from './PeasantView';
import { RESOURCE_KINDS } from './ResourceKind';
import type { World } from './World';

import { FNV_OFFSET_BASIS, feedBytes } from './checksumFeed';

/**
 * 32-bit FNV-1a over the bytes of the map's `heights` and `tiles`, then (as little-endian int32) the tick count,
 * each resource's amount and capacity in `RESOURCE_KINDS` order, each object's id, kind, tx and ty in id order,
 * each producing building's cycle progress in id order, the id and remaining skip ticks of each building skipped by
 * worker spawning in id order, the id and ticks left of each stump in id order, the id and rounds taken of each
 * chopped tree in id order, each peasant in id order (see `feedPeasant`), then the army (see `feedArmy`).
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
  for (const object of world.objects()) {
    const left = world.stumpTicksLeft(object.id);
    if (left > 0) hash = feedInt32(feedInt32(hash, object.id), left);
  }
  for (const object of world.objects()) {
    const chops = world.treeChopsTaken(object.id);
    if (chops > 0) hash = feedInt32(feedInt32(hash, object.id), chops);
  }
  for (const p of world.peasants()) hash = feedPeasant(hash, p);
  return feedArmy(hash, world) >>> 0;
}

/**
 * Everything a later tick reads of peasant `p`: id, state index, tx, ty, nextTx, nextTy, step progress, step ticks,
 * load resource (-1 for none) and amount, workplace id, delivery target id (0 for none), tree id (0 for none), wait
 * ticks, path index, the tiles still ahead on its path (count, then each tx and ty), its walk mode and hit points.
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
  hash = feedInt32(hash, p.workplaceId);
  hash = feedInt32(hash, p.targetId ?? 0);
  hash = feedInt32(hash, p.treeId ?? 0);
  hash = feedInt32(hash, p.waitTicks);
  hash = feedInt32(hash, p.pathIndex);
  hash = feedTiles(hash, p.path, p.pathIndex);
  return feedInt32(feedInt32(hash, p.walkMode), p.hitPoints);
}
