import { describe, expect, it } from 'vitest';
import { canStep, WalkClass, WalkMode } from '../src/sim/walkRules';

const { Blocked, Ground, Stairs, Top } = WalkClass;
const MODES = [WalkMode.Ground, WalkMode.Climb, WalkMode.Down];

/** A straight step from `from` to `to` in `mode`. */
const straight = (from: WalkClass, to: WalkClass, mode: WalkMode): boolean => canStep(from, to, false, Ground, Ground, mode);

describe('canStep', () => {
  it('walks between ground and stairs in every mode, straight and diagonally past open sides', () => {
    for (const mode of MODES) {
      for (const [a, b] of [[Ground, Ground], [Ground, Stairs], [Stairs, Ground]] as const) {
        expect(straight(a, b, mode)).toBe(true);
        expect(canStep(a, b, true, Ground, Stairs, mode)).toBe(true);
      }
    }
  });

  it('never cuts a corner on the ground past a blocked or wall-top side', () => {
    for (const side of [Blocked, Top]) expect(canStep(Ground, Ground, true, side, Ground, WalkMode.Climb)).toBe(false);
  });

  it('never steps onto a blocked tile', () => {
    for (const mode of MODES) for (const from of [Ground, Stairs, Top]) expect(straight(from, Blocked, mode)).toBe(false);
  });

  it('climbs from stairs onto a wall top only in Climb mode, and only straight', () => {
    expect(straight(Stairs, Top, WalkMode.Climb)).toBe(true);
    expect(straight(Stairs, Top, WalkMode.Ground)).toBe(false);
    expect(straight(Stairs, Top, WalkMode.Down)).toBe(false);
    expect(canStep(Stairs, Top, true, Top, Stairs, WalkMode.Climb)).toBe(false);
  });

  it('never climbs from the ground straight onto a wall top', () => {
    for (const mode of MODES) expect(straight(Ground, Top, mode)).toBe(false);
  });

  it('walks along the wall top in every mode, diagonally whatever the sides', () => {
    for (const mode of MODES) {
      expect(straight(Top, Top, mode)).toBe(true);
      expect(canStep(Top, Top, true, Blocked, Ground, mode)).toBe(true);
    }
  });

  it('comes down a stair from the wall top in every mode, only straight', () => {
    for (const mode of MODES) {
      expect(straight(Top, Stairs, mode)).toBe(true);
      expect(canStep(Top, Stairs, true, Top, Ground, mode)).toBe(false);
    }
  });

  it('steps off a wall top onto the ground only in Down mode, and only straight', () => {
    expect(straight(Top, Ground, WalkMode.Down)).toBe(true);
    expect(straight(Top, Ground, WalkMode.Ground)).toBe(false);
    expect(straight(Top, Ground, WalkMode.Climb)).toBe(false);
    expect(canStep(Top, Ground, true, Ground, Ground, WalkMode.Down)).toBe(false);
  });

  it('walks off a tile built over as if it were ground', () => {
    expect(straight(Blocked, Ground, WalkMode.Ground)).toBe(true);
    expect(straight(Blocked, Top, WalkMode.Climb)).toBe(false);
  });
});
