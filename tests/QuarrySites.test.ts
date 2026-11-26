import { describe, expect, it } from 'vitest';
import { MapGenerator } from '../src/sim/MapGenerator';
import { ObjectKind } from '../src/sim/ObjectKind';
import { QUARRY_CONFIG } from '../src/sim/QuarrySites';
import { TileType } from '../src/sim/tiles';
import type { World } from '../src/sim/World';

const generator = new MapGenerator();

/** Top-left tiles of every quarry site: Quarry tiles whose left and upper neighbours are not Quarry. */
function siteCorners(world: World): { tx: number; ty: number }[] {
  const { map } = world;
  const corners: { tx: number; ty: number }[] = [];
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      if (map.tileAt(tx, ty) !== TileType.Quarry) continue;
      if (map.tileAt(tx - 1, ty) === TileType.Quarry || map.tileAt(tx, ty - 1) === TileType.Quarry) continue;
      corners.push({ tx, ty });
    }
  }
  return corners;
}

describe('QuarrySites', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    describe(`seed ${seed} at 512 x 512`, () => {
      const world = generator.generate({ seed, width: 512, height: 512 });
      const { map } = world;
      const sites = siteCorners(world);
      const size = QUARRY_CONFIG.siteSize;

      it('has several quarry sites, each a full square of quarry ground', () => {
        expect(sites.length).toBeGreaterThanOrEqual(4);
        expect(sites.length).toBeLessThanOrEqual(QUARRY_CONFIG.maxSites);
        let quarryTiles = 0;
        for (const t of map.tiles) if (t === TileType.Quarry) quarryTiles++;
        expect(quarryTiles).toBe(sites.length * size * size);
      });

      it('puts every site at the foot of a mountain', () => {
        for (const { tx, ty } of sites) {
          const base = map.tileHeight(tx + 2, ty + 2);
          let mountainRock = 0;
          for (let y = ty - 2; y < ty + size + 2; y++) {
            for (let x = tx - 2; x < tx + size + 2; x++) {
              if (map.tileAt(x, y) === TileType.Rock && map.tileHeight(x, y) >= base + 1) mountainRock++;
            }
          }
          expect(mountainRock, `site at ${tx}, ${ty}`).toBeGreaterThan(0);
        }
      });

      it('keeps sites apart and free of trees', () => {
        for (const a of sites) {
          for (const b of sites) {
            if (a === b) continue;
            expect(Math.max(Math.abs(a.tx - b.tx), Math.abs(a.ty - b.ty))).toBeGreaterThanOrEqual(QUARRY_CONFIG.minSpacing);
          }
          for (let y = a.ty; y < a.ty + size; y++) for (let x = a.tx; x < a.tx + size; x++) expect(world.objectAt(x, y)).toBeUndefined();
        }
      });

      it('lets a quarry stand anywhere on a site', () => {
        for (const { tx, ty } of sites) {
          for (let dy = 0; dy <= size - 3; dy++) {
            for (let dx = 0; dx <= size - 3; dx++) {
              expect(world.canPlace(ObjectKind.Quarry, tx + dx, ty + dy), `quarry at ${tx + dx}, ${ty + dy}`).toEqual({ ok: true });
            }
          }
        }
      });
    });
  }
});
