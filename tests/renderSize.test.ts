import { describe, expect, it } from 'vitest';
import { renderSize } from '../src/render/renderSize';

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
