import { describe, expect, it } from 'vitest';
import { NO_RESOURCES, resources } from '../src/sim/ResourceKind';
import { costText } from '../src/ui/costText';

describe('costText', () => {
  it('lists every non-zero amount in resource order', () => {
    expect(costText(resources(50, 40, 0))).toBe('50 wood, 40 stone');
    expect(costText(resources(0, 5, 7))).toBe('5 stone, 7 food');
  });

  it('omits zero amounts', () => {
    expect(costText(resources(15, 0, 0))).toBe('15 wood');
  });

  it('says free when nothing is charged', () => {
    expect(costText(NO_RESOURCES)).toBe('free');
  });
});
