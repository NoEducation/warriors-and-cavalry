// Turns real frame time into a whole number of simulation ticks, with pause and speed steps.
import { GAME_CONFIG } from './GameConfig';

export class SimulationRunner {
  /** Elapsed simulation time not yet turned into ticks, in ticks (always below 1 between frames). */
  private pending = 0;
  private speedIndex = 0;
  private isPaused = false;

  /** Runs `ticksPerSecond` ticks per second of real time at 1×. Create once per game. */
  public constructor(private readonly ticksPerSecond: number) {}

  /** True while the simulation is paused. */
  public get paused(): boolean {
    return this.isPaused;
  }

  /** The current speed multiplier, one of `GAME_CONFIG.simulationSpeeds`. */
  public get speed(): number {
    return GAME_CONFIG.simulationSpeeds[this.speedIndex];
  }

  /**
   * The not-yet-run fraction of a tick, in [0, 1); 0 while paused. Read after `ticksFor` to draw movement between
   * the last tick and the next.
   */
  public get tickFraction(): number {
    return this.isPaused ? 0 : this.pending;
  }

  /** Pauses a running simulation or resumes a paused one. Call on the player's pause key. */
  public togglePause(): void {
    this.isPaused = !this.isPaused;
  }

  /** Steps to the next faster speed; stays at the fastest. */
  public faster(): void {
    this.speedIndex = Math.min(this.speedIndex + 1, GAME_CONFIG.simulationSpeeds.length - 1);
  }

  /** Steps to the next slower speed; stays at the slowest. */
  public slower(): void {
    this.speedIndex = Math.max(this.speedIndex - 1, 0);
  }

  /** Drops time accumulated towards the next tick, keeping pause and speed. Call when a new world is loaded. */
  public reset(): void {
    this.pending = 0;
  }

  /**
   * How many ticks to run for a frame that lasted `dtSeconds` of real time. Call once per frame.
   * Leftover time carries over to the next frame; paused, negative or NaN time gives 0.
   */
  public ticksFor(dtSeconds: number): number {
    if (this.isPaused || !(dtSeconds > 0)) return 0;
    this.pending += dtSeconds * this.ticksPerSecond * this.speed;
    const ticks = Math.floor(this.pending);
    if (ticks > GAME_CONFIG.maxTicksPerFrame) {
      this.pending = 0;
      return GAME_CONFIG.maxTicksPerFrame;
    }
    this.pending -= ticks;
    return ticks;
  }
}
