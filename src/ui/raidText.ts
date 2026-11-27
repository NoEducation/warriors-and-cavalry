// Player-facing text for raids, soldiers and training. No DOM.
import type { SoldierSummary } from '../sim/Army';
import { TICKS_PER_SECOND } from '../sim/gameTime';
import type { RaidView } from '../sim/RaidSchedule';
import { RESOURCE_NAMES, ResourceKind } from '../sim/ResourceKind';
import { type UnitKind, UNIT_KINDS } from '../sim/UnitKind';

/** Food first: it is what soldiers are about. */
const COST_ORDER: readonly ResourceKind[] = [ResourceKind.Food, ResourceKind.Wood, ResourceKind.Stone];

/** The banner shown while the Keep has fallen. */
export const DEFEAT_TEXT = 'Your Keep has fallen';

/** `Raid! 3 raiders` while raiders live, else `Raiders in 2:31` until the next wave; '' while no Keep stands. */
export function raidLineText(raids: RaidView): string {
  if (raids.raidersAlive > 0) return `Raid! ${raids.raidersAlive} raider${raids.raidersAlive === 1 ? '' : 's'}`;
  if (raids.ticksToNextWave === null) return '';
  const seconds = Math.ceil(raids.ticksToNextWave / TICKS_PER_SECOND);
  return `Raiders in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** `3/8`: living soldiers over the room the Barracks give; the resource bar's soldier slot. */
export function soldierCountText(soldiers: SoldierSummary): string {
  return `${soldiers.count}/${soldiers.room}`;
}

/** `Spearman · 10 food, 5 wood`: a training button's label, food first. */
export function trainButtonText(kind: UnitKind): string {
  const { name, cost } = UNIT_KINDS[kind];
  const parts = COST_ORDER.filter((k) => cost[k] > 0).map((k) => `${cost[k]} ${RESOURCE_NAMES[k]}`);
  return `${name} · ${parts.join(', ')}`;
}
