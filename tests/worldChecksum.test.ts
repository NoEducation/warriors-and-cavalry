import { describe, expect, it } from 'vitest';
import { GameMap } from '../src/sim/GameMap';
import { MapGenerator } from '../src/sim/MapGenerator';
import { ObjectKind } from '../src/sim/ObjectKind';
import { ResourceKind } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';
import { worldChecksum } from '../src/sim/worldChecksum';

const generator = new MapGenerator();

function flatMap(): GameMap {
  const size = 8;
  const tiles = new Uint8Array(size * size).fill(TileType.Grass);
  return new GameMap(size, size, 1, new Float32Array((size + 1) * (size + 1)), tiles);
}

describe('worldChecksum', () => {
  it('is the same for worlds generated from the same params', () => {
    const a = generator.generate({ seed: 42, width: 64, height: 64 });
    const b = generator.generate({ seed: 42, width: 64, height: 64 });
    expect(worldChecksum(a)).toBe(worldChecksum(b));
  });

  it('keeps the seed 1 world of 512 x 512 tiles unchanged', () => {
    // Re-recorded when the checksum started covering the tick count (was 3842414936 before that), and again when it
    // started covering resource amounts and capacities (was 541835208 before that).
    // Tree looks are render-only, so changing them must not change this value.
    expect(worldChecksum(generator.generate({ seed: 1, width: 512, height: 512 }))).toBe(1606265378);
  });

  it('differs for different seeds', () => {
    const a = generator.generate({ seed: 1, width: 128, height: 128 });
    const b = generator.generate({ seed: 2, width: 128, height: 128 });
    expect(worldChecksum(a)).not.toBe(worldChecksum(b));
  });

  it('changes after a tick', () => {
    const world = generator.generate({ seed: 3, width: 64, height: 64 });
    const before = worldChecksum(world);
    world.tick();
    expect(worldChecksum(world)).not.toBe(before);
  });

  it('changes after a building is placed', () => {
    const world = generator.generate({ seed: 3, width: 64, height: 64 });
    const before = worldChecksum(world);
    let placed = false;
    for (let ty = 0; ty < world.map.height && !placed; ty++) {
      for (let tx = 0; tx < world.map.width && !placed; tx++) {
        placed = world.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx, ty }).ok;
      }
    }
    expect(placed, 'found a buildable spot').toBe(true);
    expect(worldChecksum(world)).not.toBe(before);
  });

  it('covers resource amounts, not only objects', () => {
    // Same map, no objects and no ticks in either world; only B's wood differs, because B placed a Hovel
    // and demolished it again (net -8 wood, since the refund is half).
    const a = new World(flatMap());
    const b = new World(flatMap());
    const temp = b.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 1, ty: 1 });
    if (!temp.ok) throw new Error('placement failed');
    b.apply({ type: 'demolish', objectId: temp.object.id });
    expect(b.economy.amount(ResourceKind.Wood)).toBe(92);
    expect(worldChecksum(a)).not.toBe(worldChecksum(b));
  });
});
