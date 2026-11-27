import { describe, expect, it } from 'vitest';
import { DragTracker } from '../src/input/DragTracker';

const LEFT = 0;
const MIDDLE = 1;
const RIGHT = 2;

describe('DragTracker', () => {
  it('treats a press that stays within 4 px as a click and reports no drag', () => {
    const t = new DragTracker();
    t.press(LEFT, 100, 100);
    expect(t.move(102, 101)).toBeNull();
    expect(t.move(103, 102)).toBeNull();
    expect(t.move(104, 100)).toBeNull();
    expect(t.release()).toEqual({ button: LEFT, wasDrag: false });
  });

  it('reports drags with the pressed button once the press moved more than 4 px', () => {
    const t = new DragTracker();
    t.press(MIDDLE, 100, 100);
    expect(t.move(103, 100)).toBeNull();
    // Crossing the threshold reports the whole movement since the press.
    expect(t.move(105, 100)).toEqual({ button: MIDDLE, dx: 5, dy: 0 });
    expect(t.move(110, 97)).toEqual({ button: MIDDLE, dx: 5, dy: -3 });
    // Coming back near the start keeps it a drag.
    expect(t.move(100, 100)).toEqual({ button: MIDDLE, dx: -10, dy: 3 });
    expect(t.release()).toEqual({ button: MIDDLE, wasDrag: true });
  });

  it('returns null for moves without a press', () => {
    const t = new DragTracker();
    expect(t.move(10, 10)).toBeNull();
    expect(t.move(100, 100)).toBeNull();
  });

  it('returns null from release without a press', () => {
    expect(new DragTracker().release()).toBeNull();
  });

  it('forgets the press on cancel', () => {
    const t = new DragTracker();
    t.press(LEFT, 0, 0);
    t.move(50, 0);
    t.cancel();
    expect(t.release()).toBeNull();
    expect(t.move(60, 0)).toBeNull();
  });

  it('ignores a second button pressed while one is held, until release', () => {
    const t = new DragTracker();
    t.press(LEFT, 0, 0);
    t.press(RIGHT, 50, 50);
    expect(t.move(2, 0)).toBeNull();
    expect(t.release()).toEqual({ button: LEFT, wasDrag: false });
    t.press(RIGHT, 0, 0);
    expect(t.move(10, 0)).toEqual({ button: RIGHT, dx: 10, dy: 0 });
    expect(t.release()).toEqual({ button: RIGHT, wasDrag: true });
  });

  it('ignores non-finite positions', () => {
    const t = new DragTracker();
    t.press(MIDDLE, 0, 0);
    expect(t.move(NaN, 0)).toBeNull();
    expect(t.release()).toEqual({ button: MIDDLE, wasDrag: false });
  });
});
