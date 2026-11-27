// When raider waves come and how big they are: a timer that runs only while a Keep stands, and the Keep's fall.
import { COMBAT_CONFIG } from './combatConfig';

/** What the HUD shows of the raids. */
export interface RaidView {
  /** Waves sent since the current Keep was built (0 before the first). */
  readonly wave: number;
  /** Ticks until the next wave; null while no Keep stands. */
  readonly ticksToNextWave: number | null;
  /** True after raiders wrecked the last Keep, until a Keep stands again. */
  readonly keepFallen: boolean;
  readonly raidersAlive: number;
}

/** Raiders in wave `n` (from 1). */
export function waveSize(n: number): number {
  return n + 1;
}

/** Archers among wave `n`'s raiders; the rest are Spearmen. */
export function waveArchers(n: number): number {
  return Math.floor(n / 2);
}

export class RaidSchedule {
  private waves = 0;
  /** Ticks to the next wave; -1 while no Keep stands. */
  private countdown = -1;
  private fallen = false;

  /** Waves sent since the current Keep was built. */
  public get wave(): number {
    return this.waves;
  }

  /** Ticks until the next wave; null while no Keep stands. */
  public get ticksToNextWave(): number | null {
    return this.countdown < 0 ? null : this.countdown;
  }

  /** True after raiders wrecked the last Keep, until a Keep stands again. */
  public get keepFallen(): boolean {
    return this.fallen;
  }

  /** Call when a Keep is added: with none standing before, the count starts over at wave 0 and a full grace time. */
  public keepBuilt(): void {
    if (this.countdown >= 0) return;
    this.waves = 0;
    this.countdown = COMBAT_CONFIG.firstWaveTicks;
    this.fallen = false;
  }

  /** Call when the last Keep is gone; `wrecked` when raiders destroyed it (a defeat), not the player. */
  public keepLost(wrecked: boolean): void {
    this.countdown = -1;
    if (wrecked) this.fallen = true;
  }

  /** Counts one tick down while a Keep stands; returns the number of the wave due now, else 0. */
  public tick(): number {
    if (this.countdown < 0 || --this.countdown > 0) return 0;
    this.countdown = COMBAT_CONFIG.waveIntervalTicks;
    return ++this.waves;
  }
}
