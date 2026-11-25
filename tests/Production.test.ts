import { describe, expect, it } from 'vitest';
import { Economy } from '../src/sim/Economy';
import { GameMap } from '../src/sim/GameMap';
import type { MapObject } from '../src/sim/MapObject';
import { ObjectKind } from '../src/sim/ObjectKind';
import { Production, type ProductionOutput } from '../src/sim/Production';
import { NO_RESOURCES, ResourceKind, resources } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';

const SIZE = 64;
const WOOD = ResourceKind.Wood;
const ALWAYS = (): boolean => true;

function flatMap(): GameMap {
  const tiles = new Uint8Array(SIZE * SIZE).fill(TileType.Grass);
  return new GameMap(SIZE, SIZE, 1, new Float32Array((SIZE + 1) * (SIZE + 1)), tiles);
}

/** A Production on a flat map whose trees stand on the tiles in `trees` ("tx,ty"). */
function production(trees: Set<string>, economy = new Economy(resources(80, 40, 50))): Production {
  return new Production(flatMap(), economy, (tx, ty) => trees.has(`${tx},${ty}`));
}

/** A Woodcutter's hut at (20, 20) (covering 20..21) with a tree at `tree`, worked on `economy`. */
function hutProduction(tree: [number, number] | null, economy?: Economy): { production: Production; hut: MapObject } {
  const p = production(new Set(tree ? [`${tree[0]},${tree[1]}`] : []), economy);
  const hut: MapObject = { id: 1, kind: ObjectKind.WoodcutterHut, tx: 20, ty: 20 };
  p.added(hut);
  return { production: p, hut };
}

/** Ticks `count` times with `workerPresent`, returning every output in order. */
function run(p: Production, count: number, workerPresent: (id: number) => boolean = ALWAYS): ProductionOutput[] {
  const outputs: ProductionOutput[] = [];
  for (let i = 0; i < count; i++) outputs.push(...p.tick(workerPresent));
  return outputs;
}

describe('Production', () => {
  it('advances nothing while no worker is present', () => {
    const { production: p, hut } = hutProduction([24, 20]);
    expect(run(p, 300, () => false)).toEqual([]);
    expect(p.state(hut.id)).toEqual({ status: 'working', progress: 0, cycleTicks: 100 });
  });

  it('returns one batch of 2 wood when a worked hut near a tree completes 100 ticks, without storing it', () => {
    const economy = new Economy(resources(80, 40, 50));
    const { production: p, hut } = hutProduction([24, 20], economy);
    expect(run(p, 99)).toEqual([]);
    expect(p.state(hut.id)).toEqual({ status: 'working', progress: 99, cycleTicks: 100 });
    expect(p.tick(ALWAYS)).toEqual([{ buildingId: hut.id, resource: WOOD, amount: 2 }]);
    expect(p.state(hut.id)).toEqual({ status: 'working', progress: 0, cycleTicks: 100 });
    expect(economy.amount(WOOD)).toBe(80);
  });

  it('needs a tree within 8 tiles of the footprint, counted per axis', () => {
    for (const tree of [[29, 20], [20, 29], [29, 29], [12, 12]] as [number, number][]) {
      const { production: p, hut } = hutProduction(tree);
      expect(p.state(hut.id)?.status, `tree at ${tree}`).toBe('working');
    }
    for (const tree of [[30, 20], [21, 30], [11, 21], [30, 30]] as [number, number][]) {
      const { production: p, hut } = hutProduction(tree);
      expect(run(p, 500), `tree at ${tree}`).toEqual([]);
      expect(p.state(hut.id), `tree at ${tree}`).toEqual({ status: 'noTrees', progress: 0, cycleTicks: 100 });
    }
  });

  it('starts working when a tree is added nearby', () => {
    const trees = new Set<string>();
    const p = production(trees);
    const hut: MapObject = { id: 1, kind: ObjectKind.WoodcutterHut, tx: 20, ty: 20 };
    p.added(hut);
    expect(p.state(hut.id)?.status).toBe('noTrees');
    trees.add('25,25');
    p.added({ id: 2, kind: ObjectKind.Tree, tx: 25, ty: 25 });
    expect(p.state(hut.id)?.status).toBe('working');
  });

  it('rechecks the trees when a nearby tree is removed', () => {
    const trees = new Set(['24,20', '40,40']);
    const p = production(trees, new Economy(NO_RESOURCES)); // wood below capacity, so only the trees decide
    const hut: MapObject = { id: 1, kind: ObjectKind.WoodcutterHut, tx: 20, ty: 20 };
    p.added(hut);
    expect(p.state(hut.id)?.status).toBe('working');
    trees.delete('40,40');
    p.removed({ id: 3, kind: ObjectKind.Tree, tx: 40, ty: 40 });
    expect(p.state(hut.id)?.status).toBe('working');
    trees.delete('24,20');
    p.removed({ id: 2, kind: ObjectKind.Tree, tx: 24, ty: 20 });
    expect(p.state(hut.id)?.status).toBe('noTrees');
    p.tick(ALWAYS);
    expect(p.state(hut.id)?.progress).toBe(0);
  });

  it('runs a Quarry and a Wheat farm on their own cycles', () => {
    const p = production(new Set());
    const quarry: MapObject = { id: 1, kind: ObjectKind.Quarry, tx: 20, ty: 20 };
    const farm: MapObject = { id: 2, kind: ObjectKind.WheatFarm, tx: 40, ty: 40 };
    p.added(quarry);
    p.added(farm);
    expect(run(p, 149)).toEqual([]);
    expect(p.tick(ALWAYS)).toEqual([{ buildingId: quarry.id, resource: ResourceKind.Stone, amount: 2 }]);
    expect(run(p, 49)).toEqual([]);
    expect(p.tick(ALWAYS)).toEqual([{ buildingId: farm.id, resource: ResourceKind.Food, amount: 3 }]);
    expect(p.state(quarry.id)).toEqual({ status: 'working', progress: 50, cycleTicks: 150 });
    expect(p.state(farm.id)).toEqual({ status: 'working', progress: 0, cycleTicks: 200 });
  });

  it('pauses while storage is full and resumes from the same progress', () => {
    const economy = new Economy(resources(80, 40, 50));
    const { production: p, hut } = hutProduction([24, 20], economy);
    run(p, 30);
    economy.add(WOOD, 100);
    expect(run(p, 50)).toEqual([]);
    expect(p.state(hut.id)).toEqual({ status: 'storageFull', progress: 30, cycleTicks: 100 });
    economy.addCapacity(resources(10, 0, 0));
    expect(run(p, 69)).toEqual([]);
    expect(run(p, 1)).toHaveLength(1);
  });

  it('advances only the buildings whose worker is present, each on its own schedule', () => {
    const trees = new Set(['24,20']);
    const p = production(trees);
    const a: MapObject = { id: 1, kind: ObjectKind.WoodcutterHut, tx: 20, ty: 20 };
    const b: MapObject = { id: 2, kind: ObjectKind.WoodcutterHut, tx: 26, ty: 20 };
    p.added(a);
    p.added(b);
    run(p, 30, (id) => id === a.id);
    expect(run(p, 70)).toEqual([{ buildingId: a.id, resource: WOOD, amount: 2 }]);
    expect(p.progress(a.id)).toBe(0);
    expect(p.progress(b.id)).toBe(70);
    expect(run(p, 30)).toEqual([{ buildingId: b.id, resource: WOOD, amount: 2 }]);
    expect(p.progress(a.id)).toBe(30);
    expect(p.progress(b.id)).toBe(0);
  });

  it('forgets a removed producer', () => {
    const { production: p, hut } = hutProduction([24, 20]);
    run(p, 50);
    p.removed(hut);
    expect(p.state(hut.id)).toBeNull();
    expect(p.progress(hut.id)).toBeNull();
    expect(run(p, 300)).toEqual([]);
  });
});

describe('World production state', () => {
  it('has no production state for buildings that do not produce, trees or unknown ids', () => {
    const world = new World(flatMap());
    const tree = world.spawn(ObjectKind.Tree, 1, 1);
    const hovel = world.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 5, ty: 5 });
    if (!hovel.ok) throw new Error('placement failed');
    expect(world.productionState(tree.id)).toBeNull();
    expect(world.productionState(hovel.object.id)).toBeNull();
    expect(world.productionState(99)).toBeNull();
    expect(world.productionProgress(tree.id)).toBeNull();
    expect(world.productionProgress(hovel.object.id)).toBeNull();
    expect(world.productionProgress(99)).toBeNull();
  });
});
