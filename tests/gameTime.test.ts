import { describe, expect, it } from 'vitest';
import { formatGameTime, GAME_TIME_CONFIG, gameTimeAt, TICKS_PER_SECOND } from '../src/sim/gameTime';

describe('gameTime', () => {
  it('has the agreed rates', () => {
    expect(TICKS_PER_SECOND).toBe(10);
    expect(GAME_TIME_CONFIG.ticksPerDay).toBe(2400);
    expect(GAME_TIME_CONFIG.startHour).toBe(6);
    expect(GAME_TIME_CONFIG.minuteStep).toBe(10);
  });

  it.each([
    [0, 1, 6, 0],
    [50, 1, 6, 30],
    [99, 1, 6, 50],
    [100, 1, 7, 0],
    [1799, 1, 23, 50],
    [1800, 2, 0, 0],
    [2400, 2, 6, 0],
  ])('tick %i is day %i, %i:%i', (tick, day, hour, minute) => {
    expect(gameTimeAt(tick)).toEqual({ day, hour, minute });
  });

  it('formats as "Day N · HH:MM"', () => {
    expect(formatGameTime(gameTimeAt(0))).toBe('Day 1 · 06:00');
    expect(formatGameTime(gameTimeAt(1800))).toBe('Day 2 · 00:00');
  });
});
