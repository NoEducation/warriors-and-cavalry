// Plants deterministic forests: low-frequency density noise decides where forests are, a per-tile hash frays their edges.
import { fbm2 } from './noise';
import { ObjectKind } from './ObjectKind';
import { hash2 } from './rng';
import { TileType } from './tiles';
import type { World } from './World';

/** Forest tuning. Frozen so worlds stay reproducible; tune by editing these values here. */
export const TREE_CONFIG = Object.freeze({
  /** Forest density noise frequency per tile, and its octaves. */
  noiseScale: 1 / 32,
  octaves: 4,
  /** A grass tile gets a tree when (1 - hashWeight) * density + hashWeight * tileHash exceeds this. */
  densityThreshold: 0.63,
  /** Share of the per-tile hash in the score; higher values give more scattered trees and softer forest edges. */
  hashWeight: 0.2,
  /** Added to the map seed, so forests do not follow the terrain noise. */
  seedOffset: 0x7a3e,
});

export class TreePlacer {
  /** Spawns trees on free grass tiles of `world`, visiting tiles in row-major order. Call once while generating a world. */
  public place(world: World, seed: number): void {
    const c = TREE_CONFIG;
    const { width, height, tiles } = world.map;
    const treeSeed = (seed + c.seedOffset) | 0;
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        if (tiles[ty * width + tx] !== TileType.Grass) continue;
        const density = fbm2(treeSeed, tx * c.noiseScale, ty * c.noiseScale, c.octaves);
        const score = (1 - c.hashWeight) * density + c.hashWeight * hash2(treeSeed, tx, ty);
        if (score <= c.densityThreshold || world.objectAt(tx, ty)) continue;
        world.spawn(ObjectKind.Tree, tx, ty);
      }
    }
  }
}
