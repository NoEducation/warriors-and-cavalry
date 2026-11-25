import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PEASANT_CAPACITY, PeasantLayer } from '../src/render/PeasantLayer';
import { Economy } from '../src/sim/Economy';
import { GameMap } from '../src/sim/GameMap';
import { ObjectKind } from '../src/sim/ObjectKind';
import type { PeasantView } from '../src/sim/Peasant';
import { ResourceKind, resources } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';

function flatMap(size: number): GameMap {
  const tiles = new Uint8Array(size * size).fill(TileType.Grass);
  return new GameMap(size, size, 1, new Float32Array((size + 1) * (size + 1)), tiles);
}

/** Ticks until `done` holds (at most `max` ticks). */
function tickUntil(world: World, done: () => boolean, max = 3000): void {
  for (let n = 0; n < max; n++) {
    world.tick();
    if (done()) return;
  }
  throw new Error('condition not reached');
}

/**
 * A flat 32×32 camp: a Keep at (2, 2) (peasants arrive at (2, 6)), a Woodcutter's hut at (20, 6) with trees east of
 * it, and a Stockpile at (10, 12). Food for two arrivals.
 */
function camp(): World {
  const world = new World(flatMap(32), new Economy(resources(100, 40, 10)));
  for (let ty = 4; ty < 10; ty++) world.spawn(ObjectKind.Tree, 26, ty);
  for (const [kind, tx, ty] of [
    [ObjectKind.Keep, 2, 2],
    [ObjectKind.WoodcutterHut, 20, 6],
    [ObjectKind.Stockpile, 10, 12],
  ] as const) {
    const result = world.apply({ type: 'placeBuilding', kind, tx, ty });
    if (!result.ok) throw new Error(`placement failed: ${result.reason}`);
  }
  return world;
}

const bodies = (layer: PeasantLayer): THREE.InstancedMesh => mesh(layer, 'peasants');
const bundles = (layer: PeasantLayer): THREE.InstancedMesh => mesh(layer, 'bundles');

function mesh(layer: PeasantLayer, name: string): THREE.InstancedMesh {
  const found = layer.object.getObjectByName(name);
  if (!(found instanceof THREE.InstancedMesh)) throw new Error(`no instanced mesh ${name}`);
  return found;
}

/** Where instance `index` of `instanced` stands. */
function positionOf(instanced: THREE.InstancedMesh, index: number): THREE.Vector3 {
  const matrix = new THREE.Matrix4();
  instanced.getMatrixAt(index, matrix);
  return new THREE.Vector3().setFromMatrixPosition(matrix);
}

describe('PeasantLayer', () => {
  it('draws one body per peasant and one bundle per carrier', () => {
    const world = camp();
    const layer = new PeasantLayer(world);
    layer.update(0);
    expect(bodies(layer).count).toBe(0);
    expect(bundles(layer).count).toBe(0);
    tickUntil(world, () => world.population.count === 2);
    layer.update(0);
    expect(bodies(layer).count).toBe(2);
    expect(bundles(layer).count).toBe(0);
    tickUntil(world, () => [...world.peasants()].some((p) => p.load !== null));
    layer.update(0.5);
    const carriers = [...world.peasants()].filter((p) => p.load !== null).length;
    expect(carriers).toBe(1);
    expect(bodies(layer).count).toBe(world.population.count);
    expect(bundles(layer).count).toBe(carriers);
    layer.dispose();
  });

  it('draws a peasant one tick behind: from where it was at the last tick toward where it is now', () => {
    const world = camp();
    const layer = new PeasantLayer(world);
    let walker: PeasantView | undefined;
    tickUntil(world, () => {
      layer.update(0);
      walker = [...world.peasants()].find(
        (p) => p.stepTicks === 4 && p.stepProgress === 2 && p.nextTx === p.tx + 1 && p.nextTy === p.ty,
      );
      return walker !== undefined;
    });
    const index = [...world.peasants()].indexOf(walker!);
    // Now at 2/4 of the step (tx + 1.0); at the last tick it was at 1/4 (tx + 0.75).
    layer.update(0);
    const position = positionOf(bodies(layer), index);
    expect(position.x).toBeCloseTo(walker!.tx + 0.75);
    expect(position.z).toBeCloseTo(walker!.ty + 0.5);
    expect(position.y).toBeCloseTo(0);
    layer.update(0.5);
    expect(positionOf(bodies(layer), index).x).toBeCloseTo(walker!.tx + 0.875);
    layer.dispose();
  });

  it('moves a walker every frame, evenly, across step boundaries', () => {
    const world = new World(flatMap(32), new Economy(resources(100, 40, 5)));
    world.spawn(ObjectKind.Tree, 26, 6);
    world.apply({ type: 'placeBuilding', kind: ObjectKind.Keep, tx: 2, ty: 2 });
    world.apply({ type: 'placeBuilding', kind: ObjectKind.WoodcutterHut, tx: 20, ty: 6 }); // a long walk east
    const layer = new PeasantLayer(world);
    tickUntil(world, () => world.population.count === 1);
    for (let i = 0; i < 3; i++) {
      layer.update(0);
      world.tick();
    }
    const samples: THREE.Vector3[] = [];
    for (let tick = 0; tick < 16; tick++) {
      for (const fraction of [0, 0.25, 0.5, 0.75]) {
        layer.update(fraction);
        samples.push(positionOf(bodies(layer), 0));
      }
      world.tick();
    }
    expect([...world.peasants()][0].state).toBe('toWork'); // still walking at the end
    const moves = samples.slice(1).map((s, i) => s.distanceTo(samples[i]));
    const average = moves.reduce((sum, d) => sum + d, 0) / moves.length;
    expect(Math.min(...moves), 'no frozen frame').toBeGreaterThan(0);
    expect(Math.max(...moves), 'no jump').toBeLessThanOrEqual(2 * average);
    layer.dispose();
  });

  it('colours each bundle by the resource carried', () => {
    const world = camp();
    const layer = new PeasantLayer(world);
    tickUntil(world, () => [...world.peasants()].some((p) => p.load?.resource === ResourceKind.Wood));
    layer.update(0);
    const color = new THREE.Color();
    bundles(layer).getColorAt(0, color);
    expect(color.getHex()).toBe(0x6b4a2b);
    layer.dispose();
  });

  it(`grows past ${PEASANT_CAPACITY} peasants without throwing`, () => {
    const economy = new Economy(resources(100, 40, 50));
    const world = new World(flatMap(64), economy);
    world.spawn(ObjectKind.Keep, 2, 2);
    // 64 Hovels: housing for 4 + 256 peasants.
    for (let i = 0; i < 64; i++) world.spawn(ObjectKind.Hovel, 10 + (i % 16) * 3, 10 + Math.floor(i / 16) * 3);
    const layer = new PeasantLayer(world);
    tickUntil(
      world,
      () => {
        economy.add(ResourceKind.Food, 1);
        return world.population.count > PEASANT_CAPACITY;
      },
      20000,
    );
    expect(() => layer.update(0)).not.toThrow();
    expect(bodies(layer).count).toBe(world.population.count);
    expect(bodies(layer).instanceMatrix.count).toBeGreaterThanOrEqual(world.population.count);
    layer.dispose();
  });

  it('empties its group on dispose', () => {
    const world = camp();
    const layer = new PeasantLayer(world);
    tickUntil(world, () => world.population.count === 1);
    layer.update(0);
    layer.dispose();
    expect(layer.object.children).toHaveLength(0);
  });
});
