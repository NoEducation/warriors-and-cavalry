// Simulation tick rates and the conversion from a tick count to the in-game clock.

/** Simulation ticks per second of real time at normal (1×) speed. */
export const TICKS_PER_SECOND = 10;
/** Ticks in one game day (4 minutes of real time at 1×). */
export const TICKS_PER_DAY = 2400;
/** Hour of day 1 at tick 0. */
export const START_HOUR = 6;

const HOURS_PER_DAY = 24;
const TICKS_PER_HOUR = TICKS_PER_DAY / HOURS_PER_DAY;
/** The clock shows minutes in steps of this many. */
const MINUTE_STEP = 10;
const STEPS_PER_HOUR = 60 / MINUTE_STEP;

/** A point on the in-game clock. Days count from 1; minutes are a multiple of 10. */
export interface GameTime {
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

/** The game clock reading at `tick` (a non-negative whole tick count since the world was generated). */
export function gameTimeAt(tick: number): GameTime {
  const sinceMidnightOfDay1 = tick + START_HOUR * TICKS_PER_HOUR;
  const tickOfDay = sinceMidnightOfDay1 % TICKS_PER_DAY;
  const tickOfHour = tickOfDay % TICKS_PER_HOUR;
  return {
    day: Math.floor(sinceMidnightOfDay1 / TICKS_PER_DAY) + 1,
    hour: Math.floor(tickOfDay / TICKS_PER_HOUR),
    minute: Math.floor((tickOfHour * STEPS_PER_HOUR) / TICKS_PER_HOUR) * MINUTE_STEP,
  };
}

/** Formats `time` for the HUD, e.g. `Day 1 · 06:00`. */
export function formatGameTime(time: GameTime): string {
  return `Day ${time.day} · ${twoDigits(time.hour)}:${twoDigits(time.minute)}`;
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}
