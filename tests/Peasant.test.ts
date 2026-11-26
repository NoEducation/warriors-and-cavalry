import { describe, expect, it } from 'vitest';
import { Peasant } from '../src/sim/Peasant';
import { PEASANT_STATES } from '../src/sim/PeasantView';
import { POPULATION_CONFIG } from '../src/sim/populationConfig';
import { ResourceKind } from '../src/sim/ResourceKind';

describe('Peasant woodcutting transitions', () => {
  it('heads to a tree, chops it, and forgets it when it picks up the wood', () => {
    const p = new Peasant(3, 1, 1);
    p.takeJob(9);
    p.headToTree(7);
    expect(p).toMatchObject({ state: 'toTree', treeId: 7 });
    p.startChopping();
    expect(p).toMatchObject({ state: 'chopping', treeId: 7 });
    p.pickUp({ resource: ResourceKind.Wood, amount: 2 });
    expect(p).toMatchObject({ state: 'toStore', treeId: null });
  });

  it('forgets its tree when it goes idle or drops it', () => {
    const p = new Peasant(1, 0, 0);
    p.headToTree(4);
    p.dropTree();
    expect(p).toMatchObject({ state: 'toTree', treeId: null });
    p.headToTree(5);
    p.goIdle();
    expect(p).toMatchObject({ state: 'idle', treeId: null });
  });

  it('waits at work for retryTicks plus its id spread', () => {
    const p = new Peasant(13, 0, 0);
    p.takeJob(2);
    p.waitAtWork();
    expect(p.state).toBe('working');
    expect(p.waitTicks).toBe(POPULATION_CONFIG.retryTicks + (13 % POPULATION_CONFIG.retrySpread));
  });

  it('appends the woodcutting states after the existing ones', () => {
    expect(PEASANT_STATES).toEqual(['idle', 'toWork', 'working', 'toStore', 'toWorkBack', 'toTree', 'chopping']);
  });
});
