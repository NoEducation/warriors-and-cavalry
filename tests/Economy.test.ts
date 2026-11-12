import { describe, expect, it } from 'vitest';
import { ECONOMY_CONFIG, Economy } from '../src/sim/Economy';
import { NO_RESOURCES, RESOURCE_KINDS, RESOURCE_NAMES, ResourceKind, resources } from '../src/sim/ResourceKind';

function expectSane(economy: Economy): void {
  for (const kind of RESOURCE_KINDS) {
    const amount = economy.amount(kind);
    expect(Number.isInteger(amount), `${RESOURCE_NAMES[kind]} is a whole number`).toBe(true);
    expect(amount).toBeGreaterThanOrEqual(0);
    expect(amount).toBeLessThanOrEqual(economy.capacity(kind));
  }
}

describe('ResourceKind', () => {
  it('lists wood, stone and food in that order', () => {
    expect(RESOURCE_KINDS).toEqual([ResourceKind.Wood, ResourceKind.Stone, ResourceKind.Food]);
    expect(RESOURCE_KINDS.map((k) => RESOURCE_NAMES[k])).toEqual(['wood', 'stone', 'food']);
    expect(resources(1, 2, 3)).toEqual({ [ResourceKind.Wood]: 1, [ResourceKind.Stone]: 2, [ResourceKind.Food]: 3 });
    expect(NO_RESOURCES).toEqual(resources(0, 0, 0));
  });
});

describe('Economy', () => {
  it('starts at 100 wood, 40 stone, 50 food with capacity 100 each', () => {
    const economy = new Economy();
    expect(RESOURCE_KINDS.map((k) => economy.amount(k))).toEqual([100, 40, 50]);
    expect(RESOURCE_KINDS.map((k) => economy.capacity(k))).toEqual([100, 100, 100]);
    expect(ECONOMY_CONFIG.refundDivisor).toBe(2);
    expect(Object.isFrozen(ECONOMY_CONFIG)).toBe(true);
  });

  it('stores only what fits and reports it', () => {
    const economy = new Economy();
    expect(economy.add(ResourceKind.Wood, 30)).toBe(0);
    economy.addCapacity(resources(150, 150, 0));
    expect(economy.capacity(ResourceKind.Wood)).toBe(250);
    expect(economy.add(ResourceKind.Wood, 30)).toBe(30);
    expect(economy.add(ResourceKind.Wood, 500)).toBe(120);
    expect(economy.amount(ResourceKind.Wood)).toBe(250);
    expectSane(economy);
  });

  it('spends when it can and changes nothing when it cannot', () => {
    const economy = new Economy();
    expect(economy.spend(resources(40, 40, 0))).toBe(true);
    expect(RESOURCE_KINDS.map((k) => economy.amount(k))).toEqual([60, 0, 50]);
    expect(economy.spend(resources(0, 1, 0))).toBe(false);
    expect(RESOURCE_KINDS.map((k) => economy.amount(k))).toEqual([60, 0, 50]);
    expectSane(economy);
  });

  it('names the first missing resource', () => {
    const economy = new Economy();
    expect(economy.missing(resources(500, 500, 0))).toBe(ResourceKind.Wood);
    expect(economy.missing(resources(0, 500, 0))).toBe(ResourceKind.Stone);
    expect(economy.missing(resources(0, 0, 51))).toBe(ResourceKind.Food);
    expect(economy.missing(NO_RESOURCES)).toBeNull();
    expect(economy.canAfford(resources(100, 40, 50))).toBe(true);
    expect(economy.canAfford(resources(101, 0, 0))).toBe(false);
  });

  it('loses the excess when capacity drops', () => {
    const economy = new Economy();
    economy.addCapacity(resources(150, 150, 0));
    economy.add(ResourceKind.Wood, 500);
    expect(economy.amount(ResourceKind.Wood)).toBe(250);
    economy.removeCapacity(resources(150, 150, 0));
    expect(economy.amount(ResourceKind.Wood)).toBe(100);
    expect(economy.capacity(ResourceKind.Stone)).toBe(100);
    expect(economy.amount(ResourceKind.Stone)).toBe(40);
    expectSane(economy);
  });

  it('can start from other amounts, clamped to the base capacity', () => {
    const economy = new Economy(resources(5, 500, 0));
    expect(RESOURCE_KINDS.map((k) => economy.amount(k))).toEqual([5, 100, 0]);
    expectSane(economy);
  });
});
