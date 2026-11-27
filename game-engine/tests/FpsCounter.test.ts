import { describe, expect, it } from 'vitest';
import { FpsCounter } from '../src/game/FpsCounter';

describe('FpsCounter', () => {
  it('has no reading before the first frame', () => {
    expect(new FpsCounter(60).fps).toBeNull();
  });

  it('averages frame times', () => {
    const counter = new FpsCounter(60);
    counter.addFrame(0.02);
    counter.addFrame(0.02);
    counter.addFrame(0.02);
    expect(counter.fps).toBeCloseTo(50);
  });

  it('keeps only the last sampleCount frames', () => {
    const counter = new FpsCounter(2);
    counter.addFrame(1);
    counter.addFrame(0.1);
    counter.addFrame(0.1);
    expect(counter.fps).toBeCloseTo(10);
  });

  it('ignores zero and negative frame times', () => {
    const counter = new FpsCounter(60);
    counter.addFrame(0);
    counter.addFrame(-1);
    expect(counter.fps).toBeNull();
    counter.addFrame(0.02);
    counter.addFrame(0);
    counter.addFrame(-1);
    expect(counter.fps).toBeCloseTo(50);
  });
});
