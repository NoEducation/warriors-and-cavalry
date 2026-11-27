import { describe, expect, it } from 'vitest';
import type { ProductionStatus } from '../src/sim/Production';
import { peasantCountText, productionStatusText } from '../src/ui/statusText';

describe('peasantCountText', () => {
  it('shows workers over the worker limit, with no idle count', () => {
    expect(peasantCountText({ count: 3, housing: 8 })).toBe('3/8');
    expect(peasantCountText({ count: 0, housing: 0 })).toBe('0/0');
    expect(peasantCountText({ count: 4, housing: 4 })).toBe('4/4');
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
