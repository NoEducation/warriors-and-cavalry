import { describe, expect, it } from 'vitest';
import { MAX_TICKS_PER_FRAME, SIMULATION_SPEEDS, SimulationRunner } from '../src/game/SimulationRunner';

describe('SimulationRunner', () => {
  it('has the agreed speeds and frame cap', () => {
    expect(SIMULATION_SPEEDS).toEqual([1, 2, 4]);
    expect(MAX_TICKS_PER_FRAME).toBe(10);
  });

  it('gives one tick for 0.1 s at 1x', () => {
    expect(new SimulationRunner(10).ticksFor(0.1)).toBe(1);
  });

  it('carries leftover time to the next frame', () => {
    const runner = new SimulationRunner(10);
    expect(runner.ticksFor(0.05)).toBe(0);
    expect(runner.ticksFor(0.05)).toBe(1);
  });

  it('keeps the remainder after several ticks', () => {
    const runner = new SimulationRunner(10);
    expect(runner.ticksFor(0.25)).toBe(2);
    expect(runner.ticksFor(0.05)).toBe(1);
  });

  it('gives no ticks and accumulates nothing while paused', () => {
    const runner = new SimulationRunner(10);
    runner.togglePause();
    expect(runner.paused).toBe(true);
    expect(runner.ticksFor(0.5)).toBe(0);
    runner.togglePause();
    expect(runner.paused).toBe(false);
    expect(runner.ticksFor(0)).toBe(0);
  });

  it('runs 2 and 4 ticks per 0.1 s at 2x and 4x', () => {
    const runner = new SimulationRunner(10);
    runner.faster();
    expect(runner.speed).toBe(2);
    expect(runner.ticksFor(0.1)).toBe(2);
    runner.faster();
    expect(runner.speed).toBe(4);
    expect(runner.ticksFor(0.1)).toBe(4);
  });

  it('caps a long frame at MAX_TICKS_PER_FRAME and drops the backlog', () => {
    const runner = new SimulationRunner(10);
    expect(runner.ticksFor(5)).toBe(10);
    expect(runner.ticksFor(0)).toBe(0);
  });

  it('stops at the fastest and slowest speed', () => {
    const runner = new SimulationRunner(10);
    expect(runner.speed).toBe(1);
    runner.faster();
    runner.faster();
    runner.faster();
    expect(runner.speed).toBe(4);
    runner.slower();
    runner.slower();
    runner.slower();
    expect(runner.speed).toBe(1);
  });

  it('reset drops accumulated time but keeps pause and speed', () => {
    const runner = new SimulationRunner(10);
    expect(runner.ticksFor(0.09)).toBe(0);
    runner.reset();
    expect(runner.ticksFor(0.02)).toBe(0);

    runner.faster();
    runner.togglePause();
    runner.reset();
    expect(runner.speed).toBe(2);
    expect(runner.paused).toBe(true);
  });

  it('gives no ticks for negative or NaN dt', () => {
    const runner = new SimulationRunner(10);
    expect(runner.ticksFor(-1)).toBe(0);
    expect(runner.ticksFor(Number.NaN)).toBe(0);
    expect(runner.ticksFor(0.1)).toBe(1);
  });
});
