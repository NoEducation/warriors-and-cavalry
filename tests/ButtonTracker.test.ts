import { describe, expect, it } from 'vitest';
import { ButtonTracker } from '../src/input/ButtonTracker';

const LEFT = 0;
const MIDDLE = 1;
const RIGHT = 2;
/** `PointerEvent.buttons` bits. */
const LEFT_BIT = 1;
const RIGHT_BIT = 2;
const MIDDLE_BIT = 4;

describe('ButtonTracker', () => {
  it('holds nothing at first and reports no change for an unchanged mask', () => {
    const t = new ButtonTracker();
    expect(t.anyHeld).toBe(false);
    expect(t.update(0)).toEqual({ pressed: [], released: [] });
  });

  it('reports buttons newly held and let go since the last mask, in left, middle, right order', () => {
    const t = new ButtonTracker();
    t.set(LEFT_BIT);
    expect(t.anyHeld).toBe(true);
    expect(t.update(LEFT_BIT | RIGHT_BIT | MIDDLE_BIT)).toEqual({ pressed: [MIDDLE, RIGHT], released: [] });
    expect(t.update(LEFT_BIT | MIDDLE_BIT)).toEqual({ pressed: [], released: [RIGHT] });
    expect(t.update(RIGHT_BIT)).toEqual({ pressed: [RIGHT], released: [LEFT, MIDDLE] });
    expect(t.update(RIGHT_BIT)).toEqual({ pressed: [], released: [] });
  });

  it('records a mask from a press or release without reporting it', () => {
    const t = new ButtonTracker();
    t.set(LEFT_BIT);
    t.set(0);
    expect(t.anyHeld).toBe(false);
    expect(t.update(0)).toEqual({ pressed: [], released: [] });
  });

  it('clears the held buttons and says whether any was held', () => {
    const t = new ButtonTracker();
    expect(t.clear()).toBe(false);
    t.set(LEFT_BIT);
    expect(t.clear()).toBe(true);
    expect(t.anyHeld).toBe(false);
    expect(t.update(LEFT_BIT)).toEqual({ pressed: [LEFT], released: [] });
  });
});
