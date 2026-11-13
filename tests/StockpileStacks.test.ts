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

/** World with one stockpile holding 100 of 250 wood and 0 stone (a woodcutter brings the wood up from 70). */
function worldWithStockpile(): { world: World; stockpile: MapObject } {
  const world = flatWorld();
  world.spawn(ObjectKind.Tree, 20, 20);
  const stockpile = place(world, ObjectKind.Stockpile, 2, 2);
  place(world, ObjectKind.WoodcutterHut, 16, 16);
  for (let i = 0; i < 1500; i++) world.tick();
  return { world, stockpile };
}

describe('StockpileStacks', () => {
  it('draws nothing without a stockpile', () => {
    const stacks = new StockpileStacks(flatWorld());
    stacks.update();
    expect(stacks.object.children).toHaveLength(0);
    stacks.dispose();
  });

  it('draws ceil(8 × amount / capacity) log bundles and stone blocks', () => {
    const { world } = worldWithStockpile();
    expect(world.economy.amount(ResourceKind.Wood)).toBe(100);
    expect(world.economy.capacity(ResourceKind.Wood)).toBe(250);
    const stacks = new StockpileStacks(world);
    stacks.update();
    expect(instances(stacks, 'logs')).toBe(4);
    expect(instances(stacks, 'stones')).toBe(0);
    stacks.dispose();
  });

  it('follows the wood after update and creates nothing new when nothing changed', () => {
    const { world } = worldWithStockpile();
    const stacks = new StockpileStacks(world);
    stacks.update();
    place(world, ObjectKind.Hovel, 10, 2); // 100 - 15 = 85 wood → ceil(2.72) = 3
    stacks.update();
    expect(instances(stacks, 'logs')).toBe(3);
    const before = [...stacks.object.children];
    stacks.update();
    stacks.update();
    expect(stacks.object.children).toEqual(before);
    stacks.object.children.forEach((child, i) => expect(child).toBe(before[i]));
    stacks.dispose();
  });

  it('shows the same counts on a second stockpile and drops a demolished one', () => {
    const { world, stockpile } = worldWithStockpile();
    const second = place(world, ObjectKind.Stockpile, 2, 8); // 90 of 400 wood → ceil(1.8) = 2 each
    const stacks = new StockpileStacks(world);
    stacks.update();
    expect(instances(stacks, 'logs')).toBe(4);
    world.apply({ type: 'demolish', objectId: second.id }); // 95 of 250 wood → ceil(3.04) = 4 on one stockpile
    stacks.update();
    expect(instances(stacks, 'logs')).toBe(4);
    world.apply({ type: 'demolish', objectId: stockpile.id });
    stacks.update();
    expect(instances(stacks, 'logs')).toBe(0);
    stacks.dispose();
  });

  it('puts the stacks on the stockpile', () => {
    const { world } = worldWithStockpile();
    const stacks = new StockpileStacks(world);
    stacks.update();
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
    stacks.update();
    stacks.dispose();
    expect(stacks.object.children).toHaveLength(0);
  });
});
