import { describe, expect, it } from 'vitest';
import { NO_RESOURCES, ResourceKind, resources } from '../src/sim/ResourceKind';
import { costParts, costText, wallLineText } from '../src/ui/costText';

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

describe('costParts', () => {
  it('lists every non-zero amount with its resource, in resource order', () => {
    expect(costParts(resources(50, 40, 0))).toEqual([
      { kind: ResourceKind.Wood, amount: 50 },
      { kind: ResourceKind.Stone, amount: 40 },
    ]);
    expect(costParts(resources(0, 0, 3))).toEqual([{ kind: ResourceKind.Food, amount: 3 }]);
  });

  it('is empty when nothing is charged', () => {
    expect(costParts(NO_RESOURCES)).toEqual([]);
  });
});

describe('wallLineText', () => {
  it('counts the pieces a wall drag places and what they cost', () => {
    expect(wallLineText(12, resources(0, 24, 0))).toBe('Wall: 12 pieces, 24 stone');
    expect(wallLineText(1, resources(0, 2, 0))).toBe('Wall: 1 piece, 2 stone');
  });

  it('leaves out the cost when nothing would be placed', () => {
    expect(wallLineText(0, resources(0, 0, 0))).toBe('Wall: 0 pieces');
  });
});
