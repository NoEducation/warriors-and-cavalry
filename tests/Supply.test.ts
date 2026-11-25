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

/** A flat grass map; `water` tiles are Water. */
function flatMap(water: (tx: number, ty: number) => boolean = () => false): GameMap {
  const tiles = new Uint8Array(SIZE * SIZE).fill(TileType.Grass);
  for (let ty = 0; ty < SIZE; ty++) {
    for (let tx = 0; tx < SIZE; tx++) if (water(tx, ty)) tiles[ty * SIZE + tx] = TileType.Water;
  }
  return new GameMap(SIZE, SIZE, 1, new Float32Array((SIZE + 1) * (SIZE + 1)), tiles);
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

/** Food for exactly one arrival, so one peasant does all the work. */
const onePeasant = (): Economy => new Economy(resources(100, 40, 5));

/**
 * A flat world with a tree at (25, 8), a Keep at (2, 20) (peasants arrive at (2, 24)) and a Woodcutter's hut at
 * (20, 4) (covering 20..21 x 4..5).
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
    tickUntil(world, () => first(world)?.state === 'working');
    expect(onAccess(world, hut.id, peasant(world))).toBe(true);
    // Production runs after the peasants in a tick, so the tick it arrives in is its first working tick.
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
    tickUntil(world, () => first(world)?.state === 'working');
    expect(onAccess(world, hut.id, peasant(world))).toBe(true);
    expect(status(world, hut.id)).toBe('working');
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
    const world = new World(flatMap(), new Economy(resources(100, 0, 5)));
    world.spawn(ObjectKind.Keep, 2, 20);
    place(world, ObjectKind.WheatFarm, 20, 4); // 20..23 x 4..7
    const stockpile = place(world, ObjectKind.Stockpile, 20, 9); // its top edge (row 8) is the farm's bottom edge
    const granary = place(world, ObjectKind.Granary, 27, 4);
    ticks(world, 50);
    expect(world.economy.amount(ResourceKind.Food)).toBe(0);
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

  it('makes the worker of a demolished workplace idle, and it takes another vacant job on the next tick', () => {
    const { world, hut } = camp();
    world.spawn(ObjectKind.Tree, 15, 8);
    const other = place(world, ObjectKind.WoodcutterHut, 12, 4);
    tickUntil(world, () => first(world)?.state === 'working');
    expect(peasant(world).workplaceId).toBe(hut.id);
    expect(status(world, other.id)).toBe('noWorker');
    world.apply({ type: 'demolish', objectId: hut.id });
    expect(peasant(world)).toMatchObject({ state: 'idle', workplaceId: null, load: null });
    world.tick();
    expect(peasant(world)).toMatchObject({ state: 'toWork', workplaceId: other.id });
  });

  it('drops the load of a worker whose workplace is demolished while it carries', () => {
    const { world, hut } = camp();
    tickUntil(world, () => first(world)?.state === 'toStore', 2000);
    const before = wood(world);
    world.apply({ type: 'demolish', objectId: hut.id });
    expect(peasant(world)).toMatchObject({ state: 'idle', workplaceId: null, load: null });
    const refunded = wood(world);
    expect(refunded).toBe(before + 10);
    ticks(world, 300);
    expect(wood(world)).toBe(refunded);
    expect(peasant(world).state).toBe('idle');
  });

  it('gives up a job it cannot reach and skips that building for 200 ticks', () => {
    const ring = (tx: number, ty: number): boolean =>
      tx >= 18 && tx <= 27 && ty >= 18 && ty <= 27 && (tx === 18 || tx === 27 || ty === 18 || ty === 27);
    const world = new World(flatMap(ring), onePeasant());
    world.spawn(ObjectKind.Tree, 24, 24);
    place(world, ObjectKind.Keep, 2, 2);
    const hut = place(world, ObjectKind.WoodcutterHut, 21, 21);
    ticks(world, 49);
    expect(status(world, hut.id)).toBe('noWorker');
    world.tick();
    expect(peasant(world)).toMatchObject({ state: 'idle', workplaceId: null });
    expect(status(world, hut.id)).toBe('workerCannotReach');
    expect(world.jobSkipTicks(hut.id)).toBe(200);
    ticks(world, 199);
    expect(status(world, hut.id)).toBe('workerCannotReach');
    expect(world.jobSkipTicks(hut.id)).toBe(1);
    expect(peasant(world).state).toBe('idle');
    world.tick(); // offered again, and given up again
    expect(world.jobSkipTicks(hut.id)).toBe(200);
    expect(peasant(world).state).toBe('idle');
  });

  it('gives the worker to the lower-id hut, even when another is nearer', () => {
    const world = new World(flatMap(), onePeasant());
    world.spawn(ObjectKind.Tree, 25, 8);
    world.spawn(ObjectKind.Tree, 10, 10);
    place(world, ObjectKind.Keep, 2, 20);
    const far = place(world, ObjectKind.WoodcutterHut, 20, 4);
    const near = place(world, ObjectKind.WoodcutterHut, 8, 14);
    ticks(world, 50);
    expect(peasant(world).workplaceId).toBe(far.id);
    expect(status(world, far.id)).toBe('workerOnTheWay');
    expect(status(world, near.id)).toBe('noWorker');
  });

  it('walks off a tile a building was placed on and still reaches work', () => {
    const { world, hut } = camp();
    ticks(world, 52);
    tickUntil(world, () => peasant(world).stepTicks === 0); // standing between two steps
    const p = peasant(world);
    expect(p.state).toBe('toWork');
    place(world, ObjectKind.Hovel, p.tx, p.ty);
    expect(world.isWalkable(p.tx, p.ty)).toBe(false);
    tickUntil(world, () => first(world)?.state === 'working');
    expect(onAccess(world, hut.id, peasant(world))).toBe(true);
  });
});

describe('Supply chain determinism and speed', () => {
  const generator = new MapGenerator();

  /** A rich economy, so the commands below can all be paid for. */
  function richEconomy(): Economy {
    const economy = new Economy();
    economy.addCapacity(resources(900, 900, 900));
    for (const kind of RESOURCE_KINDS) economy.add(kind, 900);
    return economy;
  }

  /** The seed-1 512 x 512 world (its trees included) holding `economy`. */
  function seedOneWorld(economy: Economy): World {
    const generated = generator.generate({ seed: 1, width: 512, height: 512 });
    const world = new World(generated.map, economy);
    for (const object of generated.objects()) world.spawn(object.kind, object.tx, object.ty);
    return world;
  }

  /** Commands for a Keep near the map's middle, `hovels` Hovels and one of each producer and store near it. */
  function campCommands(hovels: number): WorldCommand[] {
    const probe = seedOneWorld(richEconomy());
    const kinds: ObjectKind[] = [ObjectKind.Keep, ...Array<ObjectKind>(hovels).fill(ObjectKind.Hovel)];
    kinds.push(ObjectKind.WoodcutterHut, ObjectKind.Quarry, ObjectKind.WheatFarm, ObjectKind.Stockpile);
    kinds.push(ObjectKind.Granary);
    const commands: WorldCommand[] = [];
    for (const kind of kinds) {
      const spot = nearestSpot(probe, kind);
      const command: WorldCommand = { type: 'placeBuilding', kind, tx: spot[0], ty: spot[1] };
      const result = probe.apply(command);
      expect(result.ok, `placing kind ${kind}`).toBe(true);
      commands.push(command);
    }
    return commands;
  }

  /** The placeable spot nearest the map's middle (ring by ring); a hut's spot must also have trees nearby. */
  function nearestSpot(world: World, kind: ObjectKind): [number, number] {
    for (let r = 0; r < 200; r++) {
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
    expect(a.population.count).toBe(12);
    expect(worldChecksum(a)).toBe(worldChecksum(b));
    const workers = [...a.peasants()].filter((p) => p.workplaceId !== null);
    expect(workers).toHaveLength(3);
  });

  it('runs 3000 ticks with 40 peasants quickly', () => {
    const { world, ms } = run(campCommands(9));
    expect(world.population.count).toBe(40);
    console.log(`supply chain: 3000 ticks with 40 peasants took ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(500);
  });
});
