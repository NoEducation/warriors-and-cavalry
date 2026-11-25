import { describe, expect, it } from 'vitest';
import type { ProductionStatus } from '../src/sim/Production';
import { populationText, productionStatusText } from '../src/ui/statusText';

describe('populationText', () => {
  it('shows count, housing and idle peasants', () => {
    expect(populationText({ count: 3, housing: 8, idle: 2 })).toBe('Peasants 3/8 (2 idle)');
  });

  it('leaves out the idle part when nobody is idle', () => {
    expect(populationText({ count: 0, housing: 0, idle: 0 })).toBe('Peasants 0/0');
    expect(populationText({ count: 4, housing: 4, idle: 0 })).toBe('Peasants 4/4');
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
