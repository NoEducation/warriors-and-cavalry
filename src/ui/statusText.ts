// Player-facing text for the population and a production building's state. No DOM.
import type { PopulationSummary } from '../sim/Population';
import type { ProductionStatus } from '../sim/Production';

/** How the HUD names a production building's state. */
const PRODUCTION_STATUS_TEXT: Record<ProductionStatus, string> = Object.freeze({
  working: 'working',
  noTrees: 'no trees nearby',
  storageFull: 'storage full',
  noWorker: 'no worker',
  workerOnTheWay: 'worker on the way',
  workerDelivering: 'worker delivering',
  workerCannotReach: 'worker cannot reach',
});

/** `Peasants 3/8 (2 idle)`: peasants, housing and, when any, the idle ones. */
export function populationText(population: PopulationSummary): string {
  const idle = population.idle > 0 ? ` (${population.idle} idle)` : '';
  return `Peasants ${population.count}/${population.housing}${idle}`;
}

/** `worker on the way`: what the HUD shows for a production building in `status`. */
export function productionStatusText(status: ProductionStatus): string {
  return PRODUCTION_STATUS_TEXT[status];
}
