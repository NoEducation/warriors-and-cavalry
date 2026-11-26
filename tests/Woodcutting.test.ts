import { describe, expect, it } from 'vitest';
import { Economy } from '../src/sim/Economy';
import { GameMap } from '../src/sim/GameMap';
import type { MapObject } from '../src/sim/MapObject';
import { ObjectKind } from '../src/sim/ObjectKind';
import type { PeasantView } from '../src/sim/PeasantView';
import { ResourceKind, resources } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';

/** Ticks until `done` holds (at most `max` ticks); throws when it never does. */
function tickUntil(world: World, done: () => boolean, max = 3000): void {
  for (let n = 0; n < max; n++) {
    world.tick();
    if (done()) return;
  }
  throw new Error('condition not reached');
}

function place(world: World, kind: ObjectKind, tx: number, ty: number): MapObject {
  const result = world.apply({ type: 'placeBuilding', kind, tx, ty });
  if (!result.ok) throw new Error(`placement failed: ${result.reason}`);
  return result.object;
}

/**
 * A flat 32 x 32 camp: trees on `trees`, a Keep at (2, 2), a Stockpile at (10, 12) and a Woodcutter's hut at each of
 * `huts`; food for one arrival per hut.
 */
function camp(trees: readonly (readonly [number, number])[], huts: readonly (readonly [number, number])[] = [[20, 6]]): {
  world: World;
  trees: MapObject[];
  huts: MapObject[];
} {
  const tiles = new Uint8Array(32 * 32).fill(TileType.Grass);
  const world = new World(new GameMap(32, 32, 1, new Float32Array(33 * 33), tiles), new Economy(resources(200, 80, 5 * huts.length)));
  const treeObjects = trees.map(([tx, ty]) => world.spawn(ObjectKind.Tree, tx, ty));
  place(world, ObjectKind.Keep, 2, 2);
  place(world, ObjectKind.Stockpile, 10, 12);
  const hutObjects = huts.map(([tx, ty]) => place(world, ObjectKind.WoodcutterHut, tx, ty));
  return { world, trees: treeObjects, huts: hutObjects };
}

const peasants = (world: World): PeasantView[] => [...world.peasants()];
const first = (world: World): PeasantView => peasants(world)[0];
const wood = (world: World): number => world.economy.amount(ResourceKind.Wood);
const isEdgeNeighbour = (p: PeasantView, tree: MapObject): boolean => Math.abs(p.tx - tree.tx) + Math.abs(p.ty - tree.ty) === 1;

describe('Woodcutters', () => {
  it('walk to a tree, chop it into a stump, carry the wood to storage and go back to the hut', () => {
    const { world, trees, huts } = camp([[24, 7]]);
    const [tree] = trees;
    tickUntil(world, () => world.population.count === 1 && first(world).state === 'toTree');
    expect(first(world).treeId).toBe(tree.id);
    tickUntil(world, () => first(world).state === 'chopping');
    expect(isEdgeNeighbour(first(world), tree)).toBe(true);
    expect(world.objectAt(24, 7)).toBe(tree);
    const before = wood(world);
    tickUntil(world, () => first(world).load !== null);
    expect(world.objectAt(24, 7)?.kind).toBe(ObjectKind.Stump);
    expect(first(world)).toMatchObject({ state: 'toStore', treeId: null, load: { resource: ResourceKind.Wood, amount: 2 } });
    tickUntil(world, () => first(world).state === 'toWorkBack');
    expect(wood(world)).toBe(before + 2);
    tickUntil(world, () => first(world).state === 'working');
    const atHut = world.accessTiles(huts[0].id).some((t) => t.tx === first(world).tx && t.ty === first(world).ty);
    expect(atHut).toBe(true);
  });

  it('wait at the hut showing no trees once every tree in reach is felled', () => {
    const { world, huts } = camp([[24, 7]]);
    tickUntil(world, () => world.population.count === 1 && first(world).state === 'toWorkBack');
    tickUntil(world, () => first(world).state === 'working');
    const stock = wood(world);
    const { tx, ty } = first(world);
    for (let n = 0; n < 500; n++) {
      world.tick();
      expect(first(world)).toMatchObject({ state: 'working', tx, ty });
    }
    expect(world.productionState(huts[0].id)?.status).toBe('noTrees');
    expect(wood(world)).toBe(stock);
  });

  it('pick the nearest free tree first', () => {
    const { world, trees } = camp([[27, 7], [23, 7]]);
    tickUntil(world, () => world.population.count === 1 && first(world).state === 'toTree');
    expect(first(world).treeId).toBe(trees[1].id);
  });

  it('never share a tree: each tree in a shared grove is felled exactly once', () => {
    const grove = [[24, 8], [24, 9], [25, 8], [25, 9]] as const;
    const { world, trees } = camp(grove, [[20, 6], [20, 10]]);
    const felled = new Map<number, number>();
    world.onChange((change) => {
      if (change.type === 'removed') felled.set(change.object.id, (felled.get(change.object.id) ?? 0) + 1);
    });
    tickUntil(world, () => {
      const claimed = peasants(world).map((p) => p.treeId).filter((id) => id !== null);
      expect(new Set(claimed).size).toBe(claimed.length);
      return trees.every((t) => felled.has(t.id));
    }, 5000);
    for (const t of trees) expect(felled.get(t.id)).toBe(1);
  });

  it('leave the tree standing when the hut is demolished mid-chop; another woodcutter fells it later', () => {
    const { world, trees, huts } = camp([[24, 8]], [[20, 6], [20, 10]]);
    tickUntil(world, () => peasants(world).some((p) => p.state === 'chopping'));
    const chopper = peasants(world).find((p) => p.state === 'chopping')!;
    const hutId = chopper.workplaceId!;
    expect(world.apply({ type: 'demolish', objectId: hutId }).ok).toBe(true);
    expect(peasants(world).find((p) => p.id === chopper.id)).toMatchObject({ state: 'idle', treeId: null });
    expect(world.objectAt(24, 8)).toBe(trees[0]);
    const other = huts.find((h) => h.id !== hutId)!;
    tickUntil(world, () => world.objectAt(24, 8)?.kind === ObjectKind.Stump);
    expect(peasants(world).find((p) => p.workplaceId === other.id)).toBeDefined();
  });

  it('free their tree when they leave for lack of housing, so a new woodcutter can fell it', () => {
    const tiles = new Uint8Array(32 * 32).fill(TileType.Grass);
    const economy = new Economy(resources(200, 80, 5));
    const world = new World(new GameMap(32, 32, 1, new Float32Array(33 * 33), tiles), economy);
    world.spawn(ObjectKind.Tree, 24, 7);
    const keep = place(world, ObjectKind.Keep, 2, 2);
    place(world, ObjectKind.Stockpile, 10, 12);
    place(world, ObjectKind.WoodcutterHut, 20, 6);
    tickUntil(world, () => world.population.count === 1 && first(world).state === 'toTree');
    expect(world.apply({ type: 'demolish', objectId: keep.id }).ok).toBe(true);
    expect(world.population.count).toBe(0);
    economy.add(ResourceKind.Wood, 50);
    place(world, ObjectKind.Keep, 2, 2);
    economy.add(ResourceKind.Food, 5);
    tickUntil(world, () => world.objectAt(24, 7)?.kind === ObjectKind.Stump);
  });

  it('skip a walled-in tree and fell a reachable one', () => {
    const { world, trees } = camp([[25, 7], [23, 12]]);
    for (let ty = 6; ty <= 8; ty++) {
      for (let tx = 24; tx <= 26; tx++) if (tx !== 25 || ty !== 7) place(world, ObjectKind.Wall, tx, ty);
    }
    tickUntil(world, () => {
      expect(peasants(world).some((p) => p.treeId === trees[0].id)).toBe(false);
      return world.objectAt(23, 12)?.kind === ObjectKind.Stump;
    });
    expect(world.objectAt(25, 7)).toBe(trees[0]);
  });

  it('report that the worker cannot reach when the only tree in reach is walled in', () => {
    const { world, huts } = camp([[25, 7]]);
    for (let ty = 6; ty <= 8; ty++) {
      for (let tx = 24; tx <= 26; tx++) if (tx !== 25 || ty !== 7) place(world, ObjectKind.Wall, tx, ty);
    }
    tickUntil(world, () => world.productionState(huts[0].id)?.status === 'workerCannotReach');
    expect(world.objectAt(25, 7)?.kind).toBe(ObjectKind.Tree);
  });

  it('do not stall the game when the only trees in reach stand on an island they cannot reach', () => {
    const size = 256;
    const tiles = new Uint8Array(size * size).fill(TileType.Grass);
    for (let ty = 98; ty <= 112; ty++) {
      for (let tx = 128; tx <= 142; tx++) {
        if (tx < 130 || tx > 140 || ty < 100 || ty > 110) tiles[ty * size + tx] = TileType.Water;
      }
    }
    const map = new GameMap(size, size, 1, new Float32Array((size + 1) * (size + 1)), tiles);
    const world = new World(map, new Economy(resources(200, 80, 5)));
    for (let ty = 100; ty <= 110; ty++) for (let tx = 130; tx <= 133; tx++) world.spawn(ObjectKind.Tree, tx, ty);
    place(world, ObjectKind.Keep, 100, 100);
    place(world, ObjectKind.Stockpile, 110, 110);
    const hut = place(world, ObjectKind.WoodcutterHut, 124, 104);
    let worst = 0;
    let cannotReach = false;
    for (let n = 0; n < 1500; n++) {
      const start = performance.now();
      world.tick();
      worst = Math.max(worst, performance.now() - start);
      cannotReach ||= world.productionState(hut.id)?.status === 'workerCannotReach';
    }
    expect(cannotReach).toBe(true);
    expect(worst, `slowest tick ${worst.toFixed(1)} ms`).toBeLessThan(20);
  }, 30000);
});
