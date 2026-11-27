import { describe, expect, it } from 'vitest';
import { Economy } from '../src/sim/Economy';
import { GameMap } from '../src/sim/GameMap';
import { MapGenerator } from '../src/sim/MapGenerator';
import type { MapObject } from '../src/sim/MapObject';
import { ObjectKind } from '../src/sim/ObjectKind';
import type { PeasantView } from '../src/sim/PeasantView';
import { RESOURCE_KINDS, ResourceKind, resources } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';
import type { WorldCommand } from '../src/sim/WorldCommand';
import { worldChecksum } from '../src/sim/worldChecksum';

const SIZE = 32;
const WOOD = ResourceKind.Wood;

/** A flat grass map of `size` x `size` tiles; `water` tiles are Water. */
function flatMap(water: (tx: number, ty: number) => boolean = () => false, size = SIZE): GameMap {
  const tiles = new Uint8Array(size * size).fill(TileType.Grass);
  for (let ty = 0; ty < size; ty++) {
    for (let tx = 0; tx < size; tx++) if (water(tx, ty)) tiles[ty * size + tx] = TileType.Water;
  }
  return new GameMap(size, size, 1, new Float32Array((size + 1) * (size + 1)), tiles);
}

function place(world: World, kind: ObjectKind, tx: number, ty: number): MapObject {
  const result = world.apply({ type: 'placeBuilding', kind, tx, ty });
  if (!result.ok) throw new Error(`placement failed: ${result.reason}`);
  return result.object;
}

function ticks(world: World, n: number): void {
  for (let i = 0; i < n; i++) world.tick();
}

/** Ticks until `done` holds (at most `max` ticks); returns the ticks taken. */
function tickUntil(world: World, done: () => boolean, max = 1000): number {
  for (let n = 1; n <= max; n++) {
    world.tick();
    if (done()) return n;
  }
  throw new Error('condition not reached');
}

function peasant(world: World, id = 1): PeasantView {
  const p = [...world.peasants()].find((candidate) => candidate.id === id);
  if (!p) throw new Error(`no peasant ${id}`);
  return p;
}

/** Peasant 1, or undefined before it has arrived. */
const first = (world: World): PeasantView | undefined => [...world.peasants()].find((p) => p.id === 1);

const onAccess = (world: World, objectId: number, p: PeasantView): boolean =>
  p.stepTicks === 0 && world.accessTiles(objectId).some((t) => t.tx === p.tx && t.ty === p.ty);

const wood = (world: World): number => world.economy.amount(WOOD);
const status = (world: World, id: number): string | undefined => world.productionState(id)?.status;

/** The starting wood and stone, and no food. */
const onePeasant = (): Economy => new Economy(resources(100, 40, 0));

/**
 * A flat world with a tree at (25, 8), a Keep at (2, 20) (workers appear at (2, 24)) and a Woodcutter's hut at
 * (20, 4) (covering 20..21 x 4..5): one worker.
 */
function camp(economy = onePeasant()): { world: World; keep: MapObject; hut: MapObject } {
  const world = new World(flatMap(), economy);
  world.spawn(ObjectKind.Tree, 25, 8);
  const keep = place(world, ObjectKind.Keep, 2, 20);
  const hut = place(world, ObjectKind.WoodcutterHut, 20, 4);
  return { world, keep, hut };
}

/** Ticks until peasant 1 is working, then until it delivers; returns where it stood when its load was stored. */
function untilDelivered(world: World): PeasantView {
  tickUntil(world, () => first(world)?.state === 'toStore', 2000);
  tickUntil(world, () => peasant(world).load === null);
  return peasant(world);
}

describe('Jobs and the supply chain', () => {
  it('leaves a hut without peasants unworked', () => {
    const world = new World(flatMap());
    world.spawn(ObjectKind.Tree, 25, 8);
    const hut = place(world, ObjectKind.WoodcutterHut, 20, 4);
    expect(world.productionState(hut.id)).toEqual({ status: 'noWorker', progress: 0, cycleTicks: 100 });
    ticks(world, 300);
    expect(wood(world)).toBe(80);
    expect(world.productionState(hut.id)).toEqual({ status: 'noWorker', progress: 0, cycleTicks: 100 });
  });

  it('walks to work, works a cycle, and adds the wood only when it reaches the Stockpile', () => {
    const { world, hut } = camp(new Economy());
    const stockpile = place(world, ObjectKind.Stockpile, 20, 8);
    ticks(world, 50);
    expect(peasant(world)).toMatchObject({ state: 'toWork', workplaceId: hut.id, load: null });
    expect(status(world, hut.id)).toBe('workerOnTheWay');
    tickUntil(world, () => first(world)?.state === 'toTree');
    expect(onAccess(world, hut.id, peasant(world))).toBe(true);
    tickUntil(world, () => first(world)?.state === 'chopping');
    // Production runs after the peasants in a tick, so the tick it reaches its tree in is its first working tick.
    expect(world.productionState(hut.id)).toEqual({ status: 'working', progress: 1, cycleTicks: 100 });
    const before = wood(world);
    ticks(world, 98);
    expect(world.productionState(hut.id)).toEqual({ status: 'working', progress: 99, cycleTicks: 100 });
    world.tick();
    expect(peasant(world)).toMatchObject({ state: 'toStore', load: { resource: WOOD, amount: 2 } });
    expect(world.productionState(hut.id)).toEqual({ status: 'workerDelivering', progress: 0, cycleTicks: 100 });
    expect(wood(world)).toBe(before);
    tickUntil(world, () => wood(world) !== before);
    expect(wood(world)).toBe(before + 2);
    expect(onAccess(world, stockpile.id, peasant(world))).toBe(true);
    expect(peasant(world)).toMatchObject({ state: 'toWorkBack', load: null });
    expect(status(world, hut.id)).toBe('workerDelivering');
    // The camp's only tree is felled, so back at the hut the worker waits for one.
    tickUntil(world, () => first(world)?.state === 'working');
    expect(onAccess(world, hut.id, peasant(world))).toBe(true);
    expect(status(world, hut.id)).toBe('noTrees');
  });

  it('delivers to the Keep when there is no Stockpile', () => {
    const { world, keep } = camp();
    const before = wood(world);
    const p = untilDelivered(world);
    expect(onAccess(world, keep.id, p)).toBe(true);
    expect(wood(world)).toBe(before + 2);
  });

  it('stores only what fits on delivery', () => {
    const economy = onePeasant();
    const { world } = camp(economy);
    economy.add(WOOD, 100 - wood(world) - 1);
    untilDelivered(world);
    expect(wood(world)).toBe(100);
  });

  it('takes a wheat farm\'s food to a Granary rather than to a nearer Stockpile', () => {
    const world = new World(flatMap(), new Economy(resources(100, 0, 0)));
    world.spawn(ObjectKind.Keep, 2, 20);
    place(world, ObjectKind.WheatFarm, 20, 4); // 20..23 x 4..7
    const stockpile = place(world, ObjectKind.Stockpile, 20, 9); // its top edge (row 8) is the farm's bottom edge
    const granary = place(world, ObjectKind.Granary, 27, 4);
    const p = untilDelivered(world);
    expect(onAccess(world, granary.id, p)).toBe(true);
    expect(onAccess(world, stockpile.id, p)).toBe(false);
    expect(world.economy.amount(ResourceKind.Food)).toBe(3);
  });

  it('holds the load while there is no storage place and delivers once a Stockpile is placed', () => {
    const { world, keep, hut } = camp();
    place(world, ObjectKind.Hovel, 8, 20); // keeps the peasant housed without the Keep
    ticks(world, 50);
    expect(peasant(world).state).toBe('toWork');
    world.apply({ type: 'demolish', objectId: keep.id });
    expect(world.population.count).toBe(1);
    tickUntil(world, () => first(world)?.state === 'toStore');
    const waiting = peasant(world);
    const before = wood(world);
    ticks(world, 120);
    expect(peasant(world)).toMatchObject({
      state: 'toStore', tx: waiting.tx, ty: waiting.ty, stepTicks: 0, load: { resource: WOOD, amount: 2 },
    });
    expect(world.productionState(hut.id)).toEqual({ status: 'workerDelivering', progress: 0, cycleTicks: 100 });
    expect(wood(world)).toBe(before);
    const stockpile = place(world, ObjectKind.Stockpile, 20, 8);
    const placedWood = wood(world);
    tickUntil(world, () => wood(world) !== placedWood, 100);
    expect(wood(world)).toBe(placedWood + 2);
    expect(onAccess(world, stockpile.id, peasant(world))).toBe(true);
  });

  it('re-targets to the Keep when the Stockpile it carries to is demolished', () => {
    const { world, keep } = camp();
    const stockpile = place(world, ObjectKind.Stockpile, 24, 12);
    tickUntil(world, () => first(world)?.state === 'toStore', 2000);
    ticks(world, 2);
    expect(peasant(world).load).not.toBeNull();
    world.apply({ type: 'demolish', objectId: stockpile.id });
    const before = wood(world);
    tickUntil(world, () => peasant(world).load === null);
    expect(onAccess(world, keep.id, peasant(world))).toBe(true);
    expect(wood(world)).toBe(before + 2);
  });

  it('removes the worker of a demolished workplace at once, leaving the other workers be', () => {
    const { world, hut } = camp();
    world.spawn(ObjectKind.Tree, 15, 8);
    const other = place(world, ObjectKind.WoodcutterHut, 12, 4);
    tickUntil(world, () => first(world)?.state === 'working', 4000);
    expect(peasant(world).workplaceId).toBe(hut.id);
    expect(peasant(world, 2).workplaceId).toBe(other.id);
    world.apply({ type: 'demolish', objectId: hut.id });
    expect(world.population.count).toBe(1);
    expect(first(world)).toBeUndefined();
    world.tick();
    expect([...world.peasants()].map((p) => [p.id, p.workplaceId])).toEqual([[2, other.id]]);
  });

  it('drops the load of a worker whose workplace is demolished while it carries', () => {
    const { world, hut } = camp();
    tickUntil(world, () => first(world)?.state === 'toStore', 2000);
    const before = wood(world);
    world.apply({ type: 'demolish', objectId: hut.id });
    expect(world.population.count).toBe(0);
    const refunded = wood(world);
    expect(refunded).toBe(before + 10);
    ticks(world, 300);
    expect(wood(world)).toBe(refunded);
    expect(world.population.count).toBe(0);
  });

  it('spawns no worker for a building it cannot reach and skips it for 200 ticks', () => {
    const ring = (tx: number, ty: number): boolean =>
      tx >= 18 && tx <= 27 && ty >= 18 && ty <= 27 && (tx === 18 || tx === 27 || ty === 18 || ty === 27);
    const world = new World(flatMap(ring), onePeasant());
    world.spawn(ObjectKind.Tree, 24, 24);
    place(world, ObjectKind.Keep, 2, 2);
    const hut = place(world, ObjectKind.WoodcutterHut, 21, 21);
    expect(status(world, hut.id)).toBe('noWorker');
    world.tick();
    expect(world.population.count).toBe(0);
    expect(status(world, hut.id)).toBe('workerCannotReach');
    expect(world.jobSkipTicks(hut.id)).toBe(200);
    ticks(world, 199);
    expect(status(world, hut.id)).toBe('workerCannotReach');
    expect(world.jobSkipTicks(hut.id)).toBe(1);
    world.tick(); // offered again, and skipped again
    expect(world.jobSkipTicks(hut.id)).toBe(200);
    expect(world.population.count).toBe(0);
  });

  it('gives the first worker to the lower-id hut, even when another is nearer', () => {
    const world = new World(flatMap(), onePeasant());
    world.spawn(ObjectKind.Tree, 25, 8);
    world.spawn(ObjectKind.Tree, 10, 10);
    place(world, ObjectKind.Keep, 2, 20);
    const far = place(world, ObjectKind.WoodcutterHut, 20, 4);
    const near = place(world, ObjectKind.WoodcutterHut, 8, 14);
    world.tick();
    expect(peasant(world).workplaceId).toBe(far.id);
    expect(peasant(world, 2).workplaceId).toBe(near.id);
    expect(status(world, far.id)).toBe('workerOnTheWay');
  });

  it('searches again when the next tile of its path is built over, and still reaches work', () => {
    const { world, hut } = camp();
    ticks(world, 52);
    tickUntil(world, () => peasant(world).stepTicks === 0); // standing between two steps
    const p = peasant(world);
    const next = p.path[p.pathIndex];
    place(world, ObjectKind.Hovel, next.tx, next.ty);
    const entered: string[] = [];
    tickUntil(world, () => {
      entered.push(`${peasant(world).tx},${peasant(world).ty}`);
      return peasant(world).state === 'working';
    }, 4000);
    expect(entered).not.toContain(`${next.tx},${next.ty}`);
    expect(onAccess(world, hut.id, peasant(world))).toBe(true);
  });

  it('shows workerCannotReach while its carrier waits for a storage place it cannot reach', () => {
    const moat = (tx: number, ty: number): boolean => (tx === 26 && ty >= 26) || (ty === 26 && tx >= 26);
    const world = new World(flatMap(moat), onePeasant());
    world.spawn(ObjectKind.Tree, 25, 8);
    const keep = place(world, ObjectKind.Keep, 2, 20);
    const hut = place(world, ObjectKind.WoodcutterHut, 20, 4);
    place(world, ObjectKind.Hovel, 8, 20); // keeps the peasant housed without the Keep
    place(world, ObjectKind.Stockpile, 28, 28); // inside the moat
    ticks(world, 50);
    world.apply({ type: 'demolish', objectId: keep.id });
    tickUntil(world, () => first(world)?.state === 'toStore', 2000);
    expect(peasant(world).waitTicks).toBeGreaterThan(0);
    expect(status(world, hut.id)).toBe('workerCannotReach');
  });

  it('staggers the searches of stranded carriers over several ticks', () => {
    // Three carriers on their long way to the Keep, the only storage place, when it is demolished.
    const world = new World(flatMap(() => false, 64), new Economy(resources(0, 0, 15)));
    const keep = world.spawn(ObjectKind.Keep, 2, 2);
    world.spawn(ObjectKind.Hovel, 10, 2); // houses the three without the Keep
    for (const [tx, ty] of [[52, 52], [53, 53], [52, 53]]) world.spawn(ObjectKind.Tree, tx, ty); // one per woodcutter
    for (const [tx, ty] of [[50, 50], [54, 50], [50, 54]]) world.spawn(ObjectKind.WoodcutterHut, tx, ty);
    tickUntil(world, () => [...world.peasants()].filter((p) => p.state === 'toStore').length === 3, 3000);
    world.apply({ type: 'demolish', objectId: keep.id });
    world.tick(); // each finds its target gone and searches: no storage place left
    const carriers = [...world.peasants()];
    expect(carriers.every((p) => p.state === 'toStore' && p.waitTicks > 0)).toBe(true);
    const nextSearches = new Set(carriers.map((p) => world.tickCount + p.waitTicks));
    expect(nextSearches.size).toBeGreaterThanOrEqual(2);
  });

  it('walks off a tile a building was placed on and still reaches work', () => {
    const { world, hut } = camp();
    ticks(world, 52);
    tickUntil(world, () => peasant(world).stepTicks === 0); // standing between two steps
    const p = peasant(world);
    expect(p.state).toBe('toWork');
    place(world, ObjectKind.Hovel, p.tx, p.ty);
    expect(world.isWalkable(p.tx, p.ty)).toBe(false);
    tickUntil(world, () => first(world)?.state === 'working', 4000);
    expect(onAccess(world, hut.id, peasant(world))).toBe(true);
  });
});

describe('Supply chain determinism and speed', () => {
  const generator = new MapGenerator();

  /** A rich economy, so the commands below can all be paid for. */
  function richEconomy(): Economy {
    const economy = new Economy();
    economy.addCapacity(resources(1900, 900, 900));
    for (const kind of RESOURCE_KINDS) economy.add(kind, 1900);
    return economy;
  }

  /** The seed-1 512 x 512 world (its trees included) holding `economy`. */
  function seedOneWorld(economy: Economy): World {
    const generated = generator.generate({ seed: 1, width: 512, height: 512 });
    const world = new World(generated.map, economy);
    for (const object of generated.objects()) world.spawn(object.kind, object.tx, object.ty);
    return world;
  }

  /**
   * Commands for a Keep near the map's middle, `hovels` Hovels, one of each producer and store near it, and
   * `extraFarms` more Wheat farms at least 16 tiles out, so they do not wall the Keep in.
   */
  function campCommands(hovels: number, extraFarms = 0): WorldCommand[] {
    const probe = seedOneWorld(richEconomy());
    const kinds: ObjectKind[] = [ObjectKind.Keep, ...Array<ObjectKind>(hovels).fill(ObjectKind.Hovel)];
    kinds.push(ObjectKind.WoodcutterHut, ObjectKind.Quarry, ObjectKind.WheatFarm, ObjectKind.Stockpile);
    kinds.push(ObjectKind.Granary, ...Array<ObjectKind>(extraFarms).fill(ObjectKind.WheatFarm));
    const commands: WorldCommand[] = [];
    for (const [i, kind] of kinds.entries()) {
      const spot = nearestSpot(probe, kind, i >= kinds.length - extraFarms ? 16 : 0);
      const command: WorldCommand = { type: 'placeBuilding', kind, tx: spot[0], ty: spot[1] };
      const result = probe.apply(command);
      expect(result.ok, `placing kind ${kind}`).toBe(true);
      commands.push(command);
    }
    return commands;
  }

  /**
   * The placeable spot nearest the map's middle (ring by ring, from ring `minRing`); a hut's spot must also have
   * trees nearby.
   */
  function nearestSpot(world: World, kind: ObjectKind, minRing = 0): [number, number] {
    for (let r = minRing; r < 200; r++) {
      for (let ty = 256 - r; ty <= 256 + r; ty++) {
        for (let tx = 256 - r; tx <= 256 + r; tx++) {
          if (Math.max(Math.abs(tx - 256), Math.abs(ty - 256)) !== r) continue;
          if (!world.canPlace(kind, tx, ty).ok) continue;
          if (kind === ObjectKind.WoodcutterHut && !hasTreeNear(world, tx, ty)) continue;
          return [tx, ty];
        }
      }
    }
    throw new Error(`no spot for kind ${kind}`);
  }

  function hasTreeNear(world: World, tx: number, ty: number): boolean {
    for (let y = ty - 8; y <= ty + 9; y++) {
      for (let x = tx - 8; x <= tx + 9; x++) if (world.objectAt(x, y)?.kind === ObjectKind.Tree) return true;
    }
    return false;
  }

  /** Runs 3000 ticks, applying command i at tick 5 * i; returns the world and the time the ticks took. */
  function run(commands: readonly WorldCommand[]): { world: World; ms: number } {
    const world = seedOneWorld(richEconomy());
    const start = performance.now();
    for (let tick = 0; tick < 3000; tick++) {
      if (tick % 5 === 0 && tick / 5 < commands.length) world.apply(commands[tick / 5]);
      world.tick();
    }
    return { world, ms: performance.now() - start };
  }

  it('gives equal checksums for two runs with the same commands on the same ticks', () => {
    const commands = campCommands(2);
    const a = run(commands).world;
    const b = run(commands).world;
    expect(a.population.count).toBe(3); // one worker per producer
    expect(worldChecksum(a)).toBe(worldChecksum(b));
  });

  it('stays in step over 5000 ticks of woodcutting: equal checksums every 500 ticks, trees felled into stumps', () => {
    const commands = campCommands(2);
    const [a, b] = [seedOneWorld(richEconomy()), seedOneWorld(richEconomy())];
    const trees = (world: World): number => [...world.objects()].filter((o) => o.kind === ObjectKind.Tree).length;
    const treesAtStart = trees(a);
    let stumpsSeen = 0;
    a.onChange((change) => {
      if (change.type === 'added' && change.object.kind === ObjectKind.Stump) stumpsSeen++;
    });
    for (let tick = 0; tick < 5000; tick++) {
      for (const world of [a, b]) {
        if (tick % 5 === 0 && tick / 5 < commands.length) world.apply(commands[tick / 5]);
        world.tick();
      }
      if ((tick + 1) % 500 === 0) expect(worldChecksum(a), `tick ${tick + 1}`).toBe(worldChecksum(b));
    }
    expect(stumpsSeen).toBeGreaterThan(0);
    expect(trees(a)).toBeLessThan(treesAtStart);
  }, 20000);

  it('runs 3000 ticks with 40 workers quickly', () => {
    const { world, ms } = run(campCommands(9, 37));
    expect(world.population.count).toBe(40);
    expect(ms, `supply chain: 3000 ticks with 40 workers took ${ms.toFixed(1)} ms`).toBeLessThan(500);
  });
});

describe('Workers cut off from their way', () => {
  /** Walls on the ring of tiles x 19..22, y 3..6 around the hut of `camp`; returns the wall at (20, 6). */
  function wallInHut(world: World): MapObject {
    let door: MapObject | null = null;
    for (let ty = 3; ty <= 6; ty++) {
      for (let tx = 19; tx <= 22; tx++) {
        if (tx !== 19 && tx !== 22 && ty !== 3 && ty !== 6) continue;
        const wall = world.spawn(ObjectKind.Wall, tx, ty);
        if (tx === 20 && ty === 6) door = wall;
      }
    }
    return door!;
  }

  it('keeps the job of a worker walled off from its workplace, and it gets there once the wall opens', () => {
    const { world, hut } = camp();
    world.tick();
    expect(peasant(world).state).toBe('toWork');
    const door = wallInHut(world);
    ticks(world, 300);
    expect(world.population.count).toBe(1);
    expect(peasant(world)).toMatchObject({ id: 1, state: 'toWork', workplaceId: hut.id });
    expect(peasant(world).waitTicks).toBeGreaterThan(0);
    expect(status(world, hut.id)).toBe('workerCannotReach');
    world.apply({ type: 'demolish', objectId: door.id });
    tickUntil(world, () => peasant(world).state === 'toTree' || peasant(world).state === 'chopping', 1000);
    expect(peasant(world).id).toBe(1);
  });

  it('keeps the job of a carrier walled off on its way back to work', () => {
    const { world, hut } = camp();
    tickUntil(world, () => first(world)?.state === 'toStore', 2000);
    const door = wallInHut(world);
    tickUntil(world, () => peasant(world).state === 'toWorkBack' && peasant(world).waitTicks > 0, 2000);
    expect(status(world, hut.id)).toBe('workerCannotReach');
    ticks(world, 200);
    expect(peasant(world)).toMatchObject({ id: 1, state: 'toWorkBack', workplaceId: hut.id });
    world.apply({ type: 'demolish', objectId: door.id });
    tickUntil(world, () => peasant(world).state === 'toTree' || peasant(world).state === 'chopping', 1000);
  });
});
