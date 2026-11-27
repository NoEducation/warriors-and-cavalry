import { describe, expect, it } from 'vitest';
import { Peasant } from '../src/sim/Peasant';
import { PEASANT_STATES } from '../src/sim/PeasantView';
import { POPULATION_CONFIG } from '../src/sim/populationConfig';
import { ResourceKind } from '../src/sim/ResourceKind';

describe('Peasant', () => {
  it('is born with its workplace, heading there', () => {
    const p = new Peasant(3, 1, 2, 9);
    expect(p).toMatchObject({ id: 3, tx: 1, ty: 2, state: 'toWork', workplaceId: 9, load: null, waitTicks: 0 });
  });

  it('heads to a tree, chops it, and forgets it when it picks up the wood', () => {
    const p = new Peasant(3, 1, 1, 9);
    p.headToTree(7);
    expect(p).toMatchObject({ state: 'toTree', treeId: 7 });
    p.startChopping();
    expect(p).toMatchObject({ state: 'chopping', treeId: 7 });
    p.pickUp({ resource: ResourceKind.Wood, amount: 2 });
    expect(p).toMatchObject({ state: 'toStore', treeId: null });
  });

  it('forgets its tree when it drops it', () => {
    const p = new Peasant(1, 0, 0, 2);
    p.headToTree(4);
    p.dropTree();
    expect(p).toMatchObject({ state: 'toTree', treeId: null });
  });

  it('waits at work for retryTicks plus its id spread', () => {
    const p = new Peasant(13, 0, 0, 2);
    p.waitAtWork();
    expect(p.state).toBe('working');
    expect(p.waitTicks).toBe(POPULATION_CONFIG.retryTicks + (13 % POPULATION_CONFIG.retrySpread));
  });

  it('has no idle state: every peasant is a worker', () => {
    expect(PEASANT_STATES).toEqual(['toWork', 'working', 'toStore', 'toWorkBack', 'toTree', 'chopping']);
  });
});
