import { describe, expect, it } from 'vitest';
import { DEFEAT_TEXT, raidLineText, soldierCountText, trainButtonText } from '../src/ui/raidText';
import { UnitKind } from '../src/sim/UnitKind';

describe('raid text', () => {
  it('counts down to the next wave in minutes and seconds', () => {
    expect(raidLineText({ wave: 0, ticksToNextWave: 1510, keepFallen: false, raidersAlive: 0 })).toBe('Raiders in 2:31');
    expect(raidLineText({ wave: 2, ticksToNextWave: 95, keepFallen: false, raidersAlive: 0 })).toBe('Raiders in 0:10');
  });

  it('names a raid in progress, and says nothing without a Keep', () => {
    expect(raidLineText({ wave: 3, ticksToNextWave: 1700, keepFallen: false, raidersAlive: 3 })).toBe('Raid! 3 raiders');
    expect(raidLineText({ wave: 3, ticksToNextWave: 1700, keepFallen: false, raidersAlive: 1 })).toBe('Raid! 1 raider');
    expect(raidLineText({ wave: 0, ticksToNextWave: null, keepFallen: false, raidersAlive: 0 })).toBe('');
    expect(DEFEAT_TEXT).toBe('Your Keep has fallen');
  });

  it('shows soldiers over room, and a training button with its cost', () => {
    expect(soldierCountText({ count: 3, room: 8 })).toBe('3/8');
    expect(trainButtonText(UnitKind.Spearman)).toBe('Spearman · 10 food, 5 wood');
    expect(trainButtonText(UnitKind.Archer)).toBe('Archer · 12 food, 10 wood');
  });
});
