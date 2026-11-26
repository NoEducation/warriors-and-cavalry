// Simulation tick rates and the conversion from a tick count to the in-game clock.

/** Simulation ticks per second of real time at normal (1×) speed; fixed by the simulation rules. */
export const TICKS_PER_SECOND = 10;

/** Game clock tuning. Frozen; tune by editing the values here. */
export const GAME_TIME_CONFIG = Object.freeze({
  /** Ticks in one game day (4 minutes of real time at 1×). */
  ticksPerDay: 2400,
  /** Hour of day 1 at tick 0. */
  startHour: 6,
  /** The clock shows minutes in steps of this many; divides 60. */
  minuteStep: 10,
});

const HOURS_PER_DAY = 24;
const TICKS_PER_HOUR = GAME_TIME_CONFIG.ticksPerDay / HOURS_PER_DAY;
const STEPS_PER_HOUR = 60 / GAME_TIME_CONFIG.minuteStep;

/** A point on the in-game clock. Days count from 1; minutes are a multiple of the minute step. */
export interface GameTime {
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

/** The game clock reading at `tick` (a non-negative whole tick count since the world was generated). */
export function gameTimeAt(tick: number): GameTime {
  const { ticksPerDay, startHour, minuteStep } = GAME_TIME_CONFIG;
  const sinceMidnightOfDay1 = tick + startHour * TICKS_PER_HOUR;
  const tickOfDay = sinceMidnightOfDay1 % ticksPerDay;
  const tickOfHour = tickOfDay % TICKS_PER_HOUR;
  return {
    day: Math.floor(sinceMidnightOfDay1 / ticksPerDay) + 1,
    hour: Math.floor(tickOfDay / TICKS_PER_HOUR),
    minute: Math.floor((tickOfHour * STEPS_PER_HOUR) / TICKS_PER_HOUR) * minuteStep,
  };
}

/** Formats `time` for the HUD, e.g. `Day 1 · 06:00`. */
export function formatGameTime(time: GameTime): string {
  return `Day ${time.day} · ${twoDigits(time.hour)}:${twoDigits(time.minute)}`;
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}
