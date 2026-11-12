import { describe, expect, it } from 'vitest';
import { MapGenerator } from '../src/sim/MapGenerator';
import { ObjectKind } from '../src/sim/ObjectKind';
import { worldChecksum } from '../src/sim/worldChecksum';

const generator = new MapGenerator();

describe('worldChecksum', () => {
  it('is the same for worlds generated from the same params', () => {
    const a = generator.generate({ seed: 42, width: 64, height: 64 });
    const b = generator.generate({ seed: 42, width: 64, height: 64 });
    expect(worldChecksum(a)).toBe(worldChecksum(b));
  });

  it('keeps the seed 1 world of 512 x 512 tiles unchanged', () => {
    // Re-recorded when the checksum started covering the tick count (was 3842414936 before that).
    // Tree looks are render-only, so changing them must not change this value.
    expect(worldChecksum(generator.generate({ seed: 1, width: 512, height: 512 }))).toBe(541835208);
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
});
