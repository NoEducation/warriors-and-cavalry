import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FarmCrops } from '../src/render/FarmCrops';
import { GameMap } from '../src/sim/GameMap';
import type { MapObject } from '../src/sim/MapObject';
import { ObjectKind } from '../src/sim/ObjectKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';

const SIZE = 16;

function flatWorld(): World {
  const heights = new Float32Array((SIZE + 1) * (SIZE + 1));
  const tiles = new Uint8Array(SIZE * SIZE).fill(TileType.Grass);
  return new World(new GameMap(SIZE, SIZE, 1, heights, tiles));
}

function placeFarm(world: World, tx: number, ty: number): MapObject {
  const result = world.apply({ type: 'placeBuilding', kind: ObjectKind.WheatFarm, tx, ty });
  if (!result.ok) throw new Error(`placement failed: ${result.reason}`);
  return result.object;
}

function heightOf(object: THREE.Object3D): number {
  return new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).y;
}

function colorOf(object: THREE.Object3D): THREE.Color {
  return ((object as THREE.Mesh).material as THREE.MeshLambertMaterial).color;
}

describe('FarmCrops', () => {
  it('draws one crop per wheat farm and follows placing and demolishing', () => {
    const world = flatWorld();
    placeFarm(world, 1, 1);
    const crops = new FarmCrops(world);
    crops.update();
    expect(crops.object.children).toHaveLength(1);
    const second = placeFarm(world, 8, 8);
    world.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 1, ty: 8 });
    crops.update();
    expect(crops.object.children).toHaveLength(2);
    world.apply({ type: 'demolish', objectId: second.id });
    crops.update();
    expect(crops.object.children).toHaveLength(1);
    crops.dispose();
  });

  it('grows the crop over the cycle from green to gold and cuts it back when the cycle completes', () => {
    const world = flatWorld();
    const farm = placeFarm(world, 1, 1);
    // A Keep right of the farm: its peasant works the farm and delivers to the Keep a step or two away.
    world.apply({ type: 'placeBuilding', kind: ObjectKind.Keep, tx: 6, ty: 1 });
    const crops = new FarmCrops(world);
    crops.update();
    const crop = crops.object.children[0];
    const stubble = heightOf(crop);
    const startColor = colorOf(crop).clone();

    while (world.productionProgress(farm.id) === 0) world.tick(); // until the worker has started
    for (let i = 1; i < 199; i++) world.tick();
    crops.update();
    const full = heightOf(crop);
    expect(full).toBeGreaterThan(stubble * 3);
    expect(colorOf(crop).r).toBeGreaterThan(startColor.r); // gold has more red than green does

    world.tick(); // completes the cycle
    crops.update();
    expect(heightOf(crop)).toBeCloseTo(stubble);

    for (let i = 0; i < 100; i++) world.tick();
    crops.update();
    expect(heightOf(crop) / full).toBeGreaterThan(0.4);
    expect(heightOf(crop) / full).toBeLessThan(0.6);
    expect(crops.object.children[0]).toBe(crop);
    crops.dispose();
  });

  it('puts the crop inside the farm, above its floor', () => {
    const world = flatWorld();
    world.map.heights[1 * (SIZE + 1) + 5] = 0.5; // a corner of the farm at (1, 1)
    placeFarm(world, 1, 1);
    const crops = new FarmCrops(world);
    crops.update();
    const box = new THREE.Box3().setFromObject(crops.object);
    expect(box.min.x).toBeGreaterThanOrEqual(1);
    expect(box.max.x).toBeLessThanOrEqual(5);
    expect(box.min.y).toBeGreaterThanOrEqual(0.5);
    crops.dispose();
  });

  it('empties its group on dispose', () => {
    const world = flatWorld();
    placeFarm(world, 1, 1);
    const crops = new FarmCrops(world);
    crops.update();
    crops.dispose();
    expect(crops.object.children).toHaveLength(0);
  });
});
