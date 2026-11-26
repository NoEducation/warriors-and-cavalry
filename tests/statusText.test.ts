import { describe, expect, it } from 'vitest';
import type { ProductionStatus } from '../src/sim/Production';
import { peasantCountText, productionStatusText } from '../src/ui/statusText';

describe('peasantCountText', () => {
  it('shows peasants over housing, and the idle ones when any', () => {
    expect(peasantCountText({ count: 3, housing: 8, idle: 2 })).toBe('3/8 (2 idle)');
    expect(peasantCountText({ count: 0, housing: 0, idle: 0 })).toBe('0/0');
    expect(peasantCountText({ count: 4, housing: 4, idle: 0 })).toBe('4/4');
  });
});

describe('productionStatusText', () => {
  it('names every production status', () => {
    const expected: Record<ProductionStatus, string> = {
      working: 'working',
      noTrees: 'no trees nearby',
      storageFull: 'storage full',
      noWorker: 'no worker',
      workerOnTheWay: 'worker on the way',
      workerDelivering: 'worker delivering',
      workerCannotReach: 'worker cannot reach',
    };
    for (const [status, text] of Object.entries(expected)) {
      expect(productionStatusText(status as ProductionStatus)).toBe(text);
    }
  });
});
