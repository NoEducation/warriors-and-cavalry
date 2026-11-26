import { describe, expect, it } from 'vitest';
import { ndcInBox } from '../src/input/ndc';

const BOX = { left: 10, top: 20, width: 100, height: 50 };

describe('ndcInBox', () => {
  it('maps the box corners and centre to -1..1 with +y up', () => {
    expect(ndcInBox(BOX, 10, 20)).toEqual({ x: -1, y: 1 });
    expect(ndcInBox(BOX, 110, 70)).toEqual({ x: 1, y: -1 });
    expect(ndcInBox(BOX, 60, 45)).toEqual({ x: 0, y: 0 });
  });

  it('gives null outside the box', () => {
    expect(ndcInBox(BOX, 9, 45)).toBeNull();
    expect(ndcInBox(BOX, 60, 71)).toBeNull();
  });
});
