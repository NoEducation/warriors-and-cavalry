// What the army needs to know about, and may do to, the world it fights in.
import type { Economy } from './Economy';
import type { MapObject } from './MapObject';
import type { PeasantView } from './PeasantView';
import type { PopulationHost } from './PopulationHost';

/** The world as `Army` and its helpers see it. `World` builds one. */
export interface ArmyHost extends PopulationHost {
  readonly economy: Economy;
  /** Ticks run so far (the tick being run, while the army ticks). */
  readonly tickCount: number;
  /** All peasants in ascending id order. */
  peasants(): Iterable<PeasantView>;
  /** The peasant `id`, or undefined when there is none. */
  peasantById(id: number): PeasantView | undefined;
  /** Takes `amount` hit points from peasant `id`; it dies at 0 (removed at the end of the army's tick). */
  damagePeasant(id: number, amount: number): void;
  /** Takes `amount` hit points from building `id`; at 0 it is removed (no refund). True when it has just fallen. */
  damageBuilding(id: number, amount: number): boolean;
  /** True when `id` is a standing building that can be attacked. */
  isAttackable(id: number): boolean;
  /** Removes the peasants killed this tick. Call at the end of the army's tick. */
  removeDeadPeasants(): void;
  /** Standing buildings in ascending id order. */
  objects(): Iterable<MapObject>;
}
