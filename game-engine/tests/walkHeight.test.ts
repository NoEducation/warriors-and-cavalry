import { describe, expect, it } from 'vitest';
import { WALL_SIZES } from '../src/render/buildings/castleParts';
import { TOWER_TOP } from '../src/render/buildings/TowerShape';
import { floorHeight } from '../src/render/floorHeight';
import { walkHeight } from '../src/render/walkHeight';
import { GameMap } from '../src/sim/GameMap';
import { ObjectKind } from '../src/sim/ObjectKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';

/** A 16 x 16 grass world whose ground rises 0.1 per tile toward +x. */
function slopedWorld(): World {
  const heights = new Float32Array(17 * 17);
  for (let cy = 0; cy <= 16; cy++) for (let cx = 0; cx <= 16; cx++) heights[cy * 17 + cx] = cx * 0.1;
  return new World(new GameMap(16, 16, 1, heights, new Uint8Array(16 * 16).fill(TileType.Grass)));
}

describe('walkHeight', () => {
  it('is the ground on open tiles and stairs, the wall walk on a wall, the parapet on a tower', () => {
    const world = slopedWorld();
    world.spawn(ObjectKind.Wall, 5, 5);
    world.spawn(ObjectKind.Stairs, 4, 5);
    world.spawn(ObjectKind.Tower, 8, 8);
    expect(walkHeight(world, 2, 2)).toBeCloseTo(world.map.tileHeight(2, 2));
    expect(walkHeight(world, 4, 5)).toBeCloseTo(world.map.tileHeight(4, 5));
    expect(walkHeight(world, 5, 5)).toBeCloseTo(floorHeight(world.map, ObjectKind.Wall, 5, 5) + WALL_SIZES.walkHeight);
    expect(walkHeight(world, 9, 9)).toBeCloseTo(floorHeight(world.map, ObjectKind.Tower, 8, 8) + TOWER_TOP);
  });
});
