import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { StockpileStacks } from '../src/render/StockpileStacks';
import { Economy } from '../src/sim/Economy';
import { GameMap } from '../src/sim/GameMap';
import type { MapObject } from '../src/sim/MapObject';
import { ObjectKind } from '../src/sim/ObjectKind';
import { resources, ResourceKind } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';
import type { WorldCommand } from '../src/sim/WorldCommand';

const SIZE = 24;

/** A flat grass world starting with 100 wood, no stone and 50 food. */
function flatWorld(): World {
  const heights = new Float32Array((SIZE + 1) * (SIZE + 1));
  const tiles = new Uint8Array(SIZE * SIZE).fill(TileType.Grass);
  return new World(new GameMap(SIZE, SIZE, 1, heights, tiles), new Economy(resources(100, 0, 50)));
}

function place(world: World, kind: ObjectKind, tx: number, ty: number): MapObject {
  const command: WorldCommand = { type: 'placeBuilding', kind, tx, ty };
  const result = world.apply(command);
  if (!result.ok) throw new Error(`placement failed: ${result.reason}`);
  return result.object;
}

/** Total instances drawn by the children named `name`. */
function instances(stacks: StockpileStacks, name: string): number {
  let count = 0;
  stacks.object.traverse((node) => {
    if (node instanceof THREE.InstancedMesh && node.name === name) count += node.count;
  });
  return count;
}

/** World with one stockpile holding 100 of 250 wood and 0 stone (30 wood added to the 70 left after building). */
function worldWithStockpile(): { world: World; stockpile: MapObject } {
  const economy = new Economy(resources(100, 0, 50));
  const heights = new Float32Array((SIZE + 1) * (SIZE + 1));
  const tiles = new Uint8Array(SIZE * SIZE).fill(TileType.Grass);
  const world = new World(new GameMap(SIZE, SIZE, 1, heights, tiles), economy);
  const stockpile = place(world, ObjectKind.Stockpile, 2, 2);
  place(world, ObjectKind.WoodcutterHut, 16, 16);
  economy.add(ResourceKind.Wood, 30);
  return { world, stockpile };
}

describe('StockpileStacks', () => {
  it('draws nothing without a stockpile', () => {
    const world = flatWorld();
    const stacks = new StockpileStacks(world);
    stacks.update(world);
    expect(stacks.object.children).toHaveLength(0);
    stacks.dispose();
  });

  it('draws ceil(8 × amount / capacity) log bundles and stone blocks', () => {
    const { world } = worldWithStockpile();
    expect(world.economy.amount(ResourceKind.Wood)).toBe(100);
    expect(world.economy.capacity(ResourceKind.Wood)).toBe(250);
    const stacks = new StockpileStacks(world);
    stacks.update(world);
    expect(instances(stacks, 'logs')).toBe(4);
    expect(instances(stacks, 'stones')).toBe(0);
    stacks.dispose();
  });

  it('follows the wood after update and creates nothing new when nothing changed', () => {
    const { world } = worldWithStockpile();
    const stacks = new StockpileStacks(world);
    stacks.update(world);
    place(world, ObjectKind.Hovel, 10, 2); // 100 - 15 = 85 wood → ceil(2.72) = 3
    stacks.update(world);
    expect(instances(stacks, 'logs')).toBe(3);
    const before = [...stacks.object.children];
    stacks.update(world);
    stacks.update(world);
    expect(stacks.object.children).toEqual(before);
    stacks.object.children.forEach((child, i) => expect(child).toBe(before[i]));
    stacks.dispose();
  });

  it('keeps the same mesh and changes only its count when the wood amount changes', () => {
    const { world } = worldWithStockpile();
    const stacks = new StockpileStacks(world);
    stacks.update(world);
    const logs = stacks.object.getObjectByName('logs') as THREE.InstancedMesh;
    expect(logs.count).toBe(4);
    place(world, ObjectKind.Hovel, 10, 2); // 100 - 15 = 85 wood → 3
    stacks.update(world);
    expect(stacks.object.getObjectByName('logs')).toBe(logs);
    expect(logs.count).toBe(3);
    stacks.dispose();
  });

  it('stacks the second layer of stones directly on the first', () => {
    const economy = new Economy(resources(100, 100, 50));
    const heights = new Float32Array((SIZE + 1) * (SIZE + 1));
    const tiles = new Uint8Array(SIZE * SIZE).fill(TileType.Grass);
    const world = new World(new GameMap(SIZE, SIZE, 1, heights, tiles), economy);
    place(world, ObjectKind.Stockpile, 2, 2); // 100 of 250 stone → 4 blocks, one layer; 5 starts the second
    const stacks = new StockpileStacks(world);
    stacks.update(world);
    const stones = stacks.object.getObjectByName('stones') as THREE.InstancedMesh;
    const position = (i: number): THREE.Vector3 => {
      const matrix = new THREE.Matrix4();
      stones.getMatrixAt(i, matrix);
      return new THREE.Vector3().setFromMatrixPosition(matrix);
    };
    stones.geometry.computeBoundingBox();
    const blockHeight = stones.geometry.boundingBox!.getSize(new THREE.Vector3()).y;
    // The mesh holds every slot, slot by slot; with one stockpile, slot 4 (first of the upper layer) is instance 4.
    expect(position(4).y - position(0).y).toBeCloseTo(blockHeight);
    stacks.dispose();
  });

  it('shows the same counts on a second stockpile and drops a demolished one', () => {
    const { world, stockpile } = worldWithStockpile();
    const second = place(world, ObjectKind.Stockpile, 2, 8); // 90 of 400 wood → ceil(1.8) = 2 each
    const stacks = new StockpileStacks(world);
    stacks.update(world);
    expect(instances(stacks, 'logs')).toBe(4);
    world.apply({ type: 'demolish', objectId: second.id }); // 95 of 250 wood → ceil(3.04) = 4 on one stockpile
    stacks.update(world);
    expect(instances(stacks, 'logs')).toBe(4);
    world.apply({ type: 'demolish', objectId: stockpile.id });
    stacks.update(world);
    expect(instances(stacks, 'logs')).toBe(0);
    stacks.dispose();
  });

  it('puts the stacks on the stockpile', () => {
    const { world } = worldWithStockpile();
    const stacks = new StockpileStacks(world);
    stacks.update(world);
    const box = new THREE.Box3().setFromObject(stacks.object);
    expect(box.min.x).toBeGreaterThanOrEqual(2);
    expect(box.max.x).toBeLessThanOrEqual(5);
    expect(box.min.z).toBeGreaterThanOrEqual(2);
    expect(box.max.z).toBeLessThanOrEqual(5);
    expect(box.min.y).toBeGreaterThan(0);
    stacks.dispose();
  });

  it('empties its group on dispose', () => {
    const { world } = worldWithStockpile();
    const stacks = new StockpileStacks(world);
    stacks.update(world);
    stacks.dispose();
    expect(stacks.object.children).toHaveLength(0);
  });
});
