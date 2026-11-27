// The army's part of the world checksum: hit points, units, training queues and the raid schedule.
import { feedInt32, feedTiles } from './checksumFeed';
import { TARGET_TYPES, UNIT_ORDERS, type UnitView } from './UnitView';
import type { World } from './World';

/**
 * Feeds, as int32s: the id and hit points of each damaged building in id order; each unit in id order (see
 * `feedUnit`); each Barracks' id, queue length, queued kinds and progress in id order; the raid wave, the ticks to
 * the next wave (-1 for none), whether the Keep has fallen (1/0); and the next unit id.
 */
export function feedArmy(hash: number, world: World): number {
  for (const object of world.objects()) {
    const hp = world.buildingHitPoints(object.id);
    if (hp && hp.current < hp.max) hash = feedInt32(feedInt32(hash, object.id), hp.current);
  }
  for (const unit of world.units()) hash = feedUnit(hash, unit);
  for (const [id, queue] of world.trainingQueues()) {
    hash = feedInt32(feedInt32(hash, id), queue.kinds.length);
    for (const kind of queue.kinds) hash = feedInt32(hash, kind);
    hash = feedInt32(hash, queue.progress);
  }
  const { wave, ticksToNextWave, keepFallen } = world.raids;
  hash = feedInt32(feedInt32(feedInt32(hash, wave), ticksToNextWave ?? -1), keepFallen ? 1 : 0);
  return feedInt32(hash, world.nextUnitId);
}

/**
 * Everything a later tick reads of unit `u`: id, side, kind, hit points, tx, ty, nextTx, nextTy, step progress,
 * step ticks, path index, the tiles still ahead on its path, walk mode, cooldown, order index, target type index
 * (-1 for none) and id, last strike tick, wait ticks, move tile, chase tile, ignored id and ticks.
 */
function feedUnit(hash: number, u: UnitView): number {
  const fields = [u.id, u.side, u.kind, u.hitPoints, u.tx, u.ty, u.nextTx, u.nextTy, u.stepProgress, u.stepTicks, u.pathIndex];
  for (const value of fields) hash = feedInt32(hash, value);
  hash = feedTiles(hash, u.path, u.pathIndex);
  const target = u.target ? TARGET_TYPES.indexOf(u.target.type) : -1;
  const rest = [u.walkMode, u.cooldown, UNIT_ORDERS.indexOf(u.order), target, u.target?.id ?? 0, u.lastStrikeTick, u.waitTicks];
  for (const value of rest) hash = feedInt32(hash, value);
  for (const value of [u.moveTx, u.moveTy, u.chaseTx, u.chaseTy, u.ignoreId, u.ignoreTicks]) hash = feedInt32(hash, value);
  return hash;
}
