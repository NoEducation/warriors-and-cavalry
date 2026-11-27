import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { StairsShape } from '../src/render/buildings/StairsShape';
import { WALL_SIZES } from '../src/render/buildings/castleParts';
import { stairsFacing } from '../src/render/stairsFacing';
import { GameMap } from '../src/sim/GameMap';
import { ObjectKind } from '../src/sim/ObjectKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';

function flatWorld(): World {
  return new World(new GameMap(12, 12, 1, new Float32Array(13 * 13), new Uint8Array(12 * 12).fill(TileType.Grass)));
}

/** Highest point of the mesh's vertices within `inside` of world (x, z). */
function topWhere(mesh: THREE.Mesh, inside: (x: number, z: number) => boolean): number {
  const position = mesh.geometry.getAttribute('position');
  let top = -Infinity;
  for (let i = 0; i < position.count; i++) {
    if (inside(position.getX(i), position.getZ(i))) top = Math.max(top, position.getY(i));
  }
  return top;
}

describe('stairsFacing', () => {
  it('climbs toward the first wall or tower side in north, west, east, south order; north with none', () => {
    const world = flatWorld();
    expect(stairsFacing(world, 5, 5)).toBe('north');
    world.spawn(ObjectKind.Wall, 5, 6);
    expect(stairsFacing(world, 5, 5)).toBe('south');
    world.spawn(ObjectKind.Wall, 6, 5);
    expect(stairsFacing(world, 5, 5)).toBe('east');
    world.spawn(ObjectKind.Tower, 3, 4);
    expect(stairsFacing(world, 5, 5)).toBe('west');
    world.spawn(ObjectKind.Wall, 5, 4);
    expect(stairsFacing(world, 5, 5)).toBe('north');
  });
});

describe('StairsShape', () => {
  it('rises to the wall walk on the side it faces and stays low on the other', () => {
    const shape = new StairsShape();
    const north = shape.build('north');
    expect(topWhere(north, (_x, z) => z < 0.1)).toBeCloseTo(WALL_SIZES.walkHeight);
    expect(topWhere(north, (_x, z) => z > 0.9)).toBeLessThan(0.5);
    const east = shape.build('east');
    expect(topWhere(east, (x) => x > 0.9)).toBeCloseTo(WALL_SIZES.walkHeight);
    expect(topWhere(east, (x) => x < 0.1)).toBeLessThan(0.5);
  });
});
