import { describe, expect, it } from 'vitest';
import { devicePixelBlock, renderSize } from '../src/render/renderSize';

describe('renderSize', () => {
  it('divides CSS size by the pixel scale', () => {
    expect(renderSize(900, 600, 3)).toEqual({ width: 300, height: 200 });
  });

  it('floors fractional results', () => {
    expect(renderSize(1000, 500, 3)).toEqual({ width: 333, height: 166 });
  });

  it('never goes below 1 pixel', () => {
    expect(renderSize(2, 2, 3)).toEqual({ width: 1, height: 1 });
  });

  it('returns null for zero, negative or non-finite sizes', () => {
    expect(renderSize(0, 600, 3)).toBeNull();
    expect(renderSize(900, 0, 3)).toBeNull();
    expect(renderSize(NaN, 600, 3)).toBeNull();
    expect(renderSize(-5, 5, 3)).toBeNull();
  });
});

describe('devicePixelBlock', () => {
  it('uses the pixel scale unchanged at a device pixel ratio of 1', () => {
    expect(devicePixelBlock(3, 1)).toBe(3);
  });

  it('rounds fractional ratios to whole device pixels (half up)', () => {
    expect(devicePixelBlock(3, 1.25)).toBe(4);
    expect(devicePixelBlock(3, 1.5)).toBe(5);
  });

  it('scales with integer ratios', () => {
    expect(devicePixelBlock(3, 2)).toBe(6);
  });

  it('treats a non-positive or non-finite ratio as 1', () => {
    expect(devicePixelBlock(3, 0)).toBe(3);
    expect(devicePixelBlock(3, NaN)).toBe(3);
  });
});
