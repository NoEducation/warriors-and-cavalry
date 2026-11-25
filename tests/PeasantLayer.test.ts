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

  it('draws a peasant halfway through a straight step east at the tile edge between the two centres', () => {
    const world = camp();
    const layer = new PeasantLayer(world);
    let walker: PeasantView | undefined;
    tickUntil(world, () => {
      walker = [...world.peasants()].find(
        (p) => p.stepTicks === 4 && p.stepProgress === 2 && p.nextTx === p.tx + 1 && p.nextTy === p.ty,
      );
      return walker !== undefined;
    });
    const index = [...world.peasants()].indexOf(walker!);
    layer.update(0);
    const position = positionOf(bodies(layer), index);
    expect(position.x).toBeCloseTo(walker!.tx + 1.0);
    expect(position.z).toBeCloseTo(walker!.ty + 0.5);
    expect(position.y).toBeCloseTo(0);
    // The tick fraction moves it on: a quarter tick more is 1/16 of a tile further.
    layer.update(0.25);
    expect(positionOf(bodies(layer), index).x).toBeCloseTo(walker!.tx + 1.0625);
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
