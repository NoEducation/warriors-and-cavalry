import { describe, expect, it } from 'vitest';
import { Economy } from '../src/sim/Economy';
import { GameMap } from '../src/sim/GameMap';
import type { MapObject } from '../src/sim/MapObject';
import { ObjectKind } from '../src/sim/ObjectKind';
import { PATH_CONFIG } from '../src/sim/pathConfig';
import type { PeasantView } from '../src/sim/PeasantView';
import { ResourceKind, resources } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import type { WalkClass } from '../src/sim/walkRules';
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
  it('walk to a tree, chop a round of wood from it, carry the wood to storage and go back to the hut', () => {
    const { world, trees, huts } = camp([[24, 7]]);
    const [tree] = trees;
    tickUntil(world, () => world.population.count === 1 && first(world).state === 'toTree');
    expect(first(world).treeId).toBe(tree.id);
    tickUntil(world, () => first(world).state === 'chopping');
    expect(isEdgeNeighbour(first(world), tree)).toBe(true);
    expect(world.objectAt(24, 7)).toBe(tree);
    const before = wood(world);
    tickUntil(world, () => first(world).load !== null);
    expect(world.objectAt(24, 7)).toBe(tree);
    expect(world.treeChopsTaken(tree.id)).toBe(1);
    expect(first(world)).toMatchObject({ state: 'toStore', treeId: null, load: { resource: ResourceKind.Wood, amount: 2 } });
    tickUntil(world, () => first(world).state === 'toWorkBack');
    expect(wood(world)).toBe(before + 2);
    tickUntil(world, () => first(world).state === 'working');
    const atHut = world.accessTiles(huts[0].id).some((t) => t.tx === first(world).tx && t.ty === first(world).ty);
    expect(atHut).toBe(true);
  });

  it('take four rounds of wood from a tree, 8 wood in all, before it falls into a stump', () => {
    const { world, trees } = camp([[24, 7]]);
    const [tree] = trees;
    const chopped: number[] = [];
    world.onChange((change) => {
      if (change.type === 'chopped') chopped.push(world.treeChopsTaken(change.object.id));
    });
    const before = wood(world);
    tickUntil(world, () => world.objectAt(24, 7)?.kind === ObjectKind.Stump, 8000);
    expect(chopped).toEqual([1, 2, 3]);
    expect(world.treeChopsTaken(tree.id)).toBe(0);
    tickUntil(world, () => first(world).state === 'working');
    expect(wood(world)).toBe(before + 8);
  });

  it('go back to a started tree before an untouched one, even when the untouched one is nearer', () => {
    const { world, trees } = camp([[27, 7], [23, 7]]);
    tickUntil(world, () => world.population.count === 1 && first(world).state === 'toTree');
    expect(first(world).treeId).toBe(trees[1].id);
    tickUntil(world, () => first(world).load !== null);
    // A fresh tree appears right next to the hut while the started one is still standing.
    world.spawn(ObjectKind.Tree, 22, 6);
    tickUntil(world, () => first(world).state === 'toTree');
    expect(first(world).treeId).toBe(trees[1].id);
  });

  it('wait at the hut showing no trees once every tree in reach is felled', () => {
    const { world, huts } = camp([[24, 7]]);
    tickUntil(world, () => world.population.count === 1 && world.objectAt(24, 7)?.kind === ObjectKind.Stump, 8000);
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
    }, 20000);
    for (const t of trees) expect(felled.get(t.id)).toBe(1);
  });

  it('leave the tree standing with its rounds taken when the hut is demolished mid-chop; another finishes it', () => {
    const { world, trees, huts } = camp([[24, 8]], [[20, 6], [20, 10]]);
    let rounds = 0;
    world.onChange((change) => {
      if (change.type === 'chopped' || change.type === 'removed') rounds += change.object.id === trees[0].id ? 1 : 0;
    });
    tickUntil(world, () => world.treeChopsTaken(trees[0].id) === 2 && peasants(world).some((p) => p.state === 'chopping'), 8000);
    const chopper = peasants(world).find((p) => p.state === 'chopping')!;
    const hutId = chopper.workplaceId!;
    expect(world.apply({ type: 'demolish', objectId: hutId }).ok).toBe(true);
    expect(peasants(world).find((p) => p.id === chopper.id)).toBeUndefined(); // it died with its hut
    expect(world.objectAt(24, 8)).toBe(trees[0]);
    expect(world.treeChopsTaken(trees[0].id)).toBe(2);
    const other = huts.find((h) => h.id !== hutId)!;
    tickUntil(world, () => world.objectAt(24, 8)?.kind === ObjectKind.Stump, 8000);
    expect(rounds).toBe(4);
    expect(peasants(world).find((p) => p.workplaceId === other.id)).toBeDefined();
  });

  it('free their tree when they die for lack of housing, so a new woodcutter can fell it', () => {
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
    tickUntil(world, () => world.objectAt(24, 7)?.kind === ObjectKind.Stump, 8000);
  });

  it('skip a walled-in tree and fell a reachable one', () => {
    const { world, trees } = camp([[25, 7], [23, 12]]);
    for (let ty = 6; ty <= 8; ty++) {
      for (let tx = 24; tx <= 26; tx++) if (tx !== 25 || ty !== 7) place(world, ObjectKind.Wall, tx, ty);
    }
    tickUntil(world, () => {
      expect(peasants(world).some((p) => p.treeId === trees[0].id)).toBe(false);
      return world.objectAt(23, 12)?.kind === ObjectKind.Stump;
    }, 8000);
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

  it('keep the job of a woodcutter whose only tree is walled in, and fell it once the wall opens', () => {
    const { world, huts } = camp([[25, 7]]);
    for (let ty = 6; ty <= 8; ty++) {
      for (let tx = 24; tx <= 26; tx++) if (tx !== 25 || ty !== 7) place(world, ObjectKind.Wall, tx, ty);
    }
    tickUntil(world, () => world.productionState(huts[0].id)?.status === 'workerCannotReach');
    for (let i = 0; i < 300; i++) world.tick();
    expect(peasants(world)).toHaveLength(1);
    expect(peasants(world)[0]).toMatchObject({ id: 1, workplaceId: huts[0].id, state: 'toTree', treeId: null });
    expect(world.apply({ type: 'demolish', objectId: world.objectAt(24, 7)!.id }).ok).toBe(true);
    tickUntil(world, () => world.treeChopsTaken(world.objectAt(25, 7)!.id) > 0, 2000);
    expect(peasants(world)[0].id).toBe(1);
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
    // Path searches ask the world what each tile is to a walker; count those questions per tick as the measure of work.
    let asked = 0;
    const walkClass = world.walkClass.bind(world);
    world.walkClass = (tx: number, ty: number): WalkClass => {
      asked++;
      return walkClass(tx, ty);
    };
    let worst = 0;
    let cannotReach = false;
    for (let n = 0; n < 1500; n++) {
      asked = 0;
      world.tick();
      worst = Math.max(worst, asked);
      cannotReach ||= world.productionState(hut.id)?.status === 'workerCannotReach';
    }
    expect(cannotReach).toBe(true);
    // A search bounded by treeSearchMaxExpanded asks about 8 neighbours per tile; a whole-map search asks ~500 000.
    expect(worst).toBeLessThan(8 * PATH_CONFIG.treeSearchMaxExpanded + 1000);
  }, 30000);
});
