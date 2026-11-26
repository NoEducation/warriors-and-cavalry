import { describe, expect, it } from 'vitest';
import type { GameMap } from '../src/sim/GameMap';
import { MapGenerator } from '../src/sim/MapGenerator';
import { ObjectKind } from '../src/sim/ObjectKind';
import { QUARRY_CONFIG } from '../src/sim/QuarrySites';
import { TileType } from '../src/sim/tiles';

const generator = new MapGenerator();

interface Tile {
  readonly tx: number;
  readonly ty: number;
}

/** Every 4-connected patch of quarry ground, in row-major order of its first tile. */
function sitesOf(map: GameMap): Tile[][] {
  const seen = new Uint8Array(map.width * map.height);
  const sites: Tile[][] = [];
  for (let i = 0; i < seen.length; i++) {
    if (seen[i] || map.tiles[i] !== TileType.Quarry) continue;
    const site: Tile[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length > 0) {
      const j = stack.pop()!;
      const tx = j % map.width;
      const ty = Math.floor(j / map.width);
      site.push({ tx, ty });
      for (const [x, y] of [[tx - 1, ty], [tx + 1, ty], [tx, ty - 1], [tx, ty + 1]]) {
        const k = y * map.width + x;
        if (map.tileAt(x, y) === TileType.Quarry && !seen[k]) {
          seen[k] = 1;
          stack.push(k);
        }
      }
    }
    sites.push(site);
  }
  return sites;
}

describe('QuarrySites', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    describe(`seed ${seed} at 512 x 512`, () => {
      const world = generator.generate({ seed, width: 512, height: 512 });
      const { map } = world;
      const sites = sitesOf(map);

      it('has several separate quarry sites', () => {
        expect(sites.length).toBeGreaterThanOrEqual(4);
        expect(sites.length).toBeLessThanOrEqual(QUARRY_CONFIG.maxSites);
      });

      it('gives every site room for a quarry', () => {
        for (const site of sites) {
          const fits = site.some(({ tx, ty }) => world.canPlace(ObjectKind.Quarry, tx, ty).ok);
          expect(fits, `site at ${site[0].tx}, ${site[0].ty}`).toBe(true);
        }
      });

      it('grows irregular sites, not squares', () => {
        const core = QUARRY_CONFIG.coreSize * QUARRY_CONFIG.coreSize;
        let irregular = 0;
        for (const site of sites) {
          expect(site.length).toBeGreaterThanOrEqual(core);
          const xs = site.map((t) => t.tx);
          const ys = site.map((t) => t.ty);
          const box = (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1);
          if (site.length > core && site.length < box) irregular++;
        }
        expect(irregular).toBeGreaterThanOrEqual(Math.ceil(sites.length * 0.75));
      });

      it('puts every site at the foot of a mountain', () => {
        for (const site of sites) {
          const base = Math.min(...site.map((t) => map.tileHeight(t.tx, t.ty)));
          const nearMountain = site.some(({ tx, ty }) => {
            for (let y = ty - 2; y <= ty + 2; y++) {
              for (let x = tx - 2; x <= tx + 2; x++) {
                if (map.tileAt(x, y) === TileType.Rock && map.tileHeight(x, y) >= base + 1) return true;
              }
            }
            return false;
          });
          expect(nearMountain, `site at ${site[0].tx}, ${site[0].ty}`).toBe(true);
        }
      });

      it('keeps trees off quarry ground', () => {
        for (const site of sites) for (const { tx, ty } of site) expect(world.objectAt(tx, ty)).toBeUndefined();
      });
    });
  }
});
