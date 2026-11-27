import { beforeAll, describe, expect, it } from 'vitest';
import { treeAppearance, type TreeAppearance } from '../src/render/treeAppearance';
import { ALL_TREE_SPECIES, TreeSpecies } from '../src/render/TreeSpecies';
import { MapGenerator } from '../src/sim/MapGenerator';
import type { MapObject } from '../src/sim/MapObject';
import { ObjectKind } from '../src/sim/ObjectKind';
import type { World } from '../src/sim/World';

const SEEDS = [1, 2, 3];
const MAX_LEAN = (6.5 * Math.PI) / 180;

interface SampledTree {
  readonly tree: MapObject;
  readonly altitude: number;
  readonly look: TreeAppearance;
}

function sample(world: World): SampledTree[] {
  const out: SampledTree[] = [];
  for (const tree of world.objects()) {
    if (tree.kind !== ObjectKind.Tree) continue;
    out.push({ tree, altitude: world.map.tileHeight(tree.tx, tree.ty), look: treeAppearance(world.map, tree.tx, tree.ty) });
  }
  return out;
}

/** Share of each species among `trees`, indexed by species id. */
function shares(trees: readonly SampledTree[]): number[] {
  const counts = ALL_TREE_SPECIES.map(() => 0);
  for (const t of trees) counts[t.look.species]++;
  return counts.map((c) => c / trees.length);
}

function mostCommon(trees: readonly SampledTree[]): TreeSpecies {
  const s = shares(trees);
  return ALL_TREE_SPECIES.reduce((best, sp) => (s[sp] > s[best] ? sp : best));
}

describe('treeAppearance', () => {
  const worlds = new Map<number, World>();
  const samples = new Map<number, SampledTree[]>();

  beforeAll(() => {
    const generator = new MapGenerator();
    for (const seed of SEEDS) {
      const world = generator.generate({ seed, width: 512, height: 512 });
      worlds.set(seed, world);
      samples.set(seed, sample(world));
    }
  });

  it('gives the same result when called twice', () => {
    for (const seed of SEEDS) {
      const map = worlds.get(seed)!.map;
      for (const { tree, look } of samples.get(seed)!) expect(treeAppearance(map, tree.tx, tree.ty)).toEqual(look);
    }
  });

  it('uses all four species', () => {
    for (const seed of SEEDS) {
      const found = new Set(samples.get(seed)!.map((t) => t.look.species));
      expect([...found].sort()).toEqual([...ALL_TREE_SPECIES]);
    }
  });

  it('keeps scale, rotation, lean and tint inside their ranges', () => {
    // Checked with plain comparisons and asserted once: an expect per value over every tree of three 512 x 512 maps
    // made this test hit the 5 s limit when the whole suite runs.
    const inRange = (look: TreeAppearance): boolean =>
      look.heightScale >= 0.7 &&
      look.heightScale <= 1.3 &&
      look.widthScale >= 0.8 &&
      look.widthScale <= 1.2 &&
      look.rotation >= 0 &&
      look.rotation < 2 * Math.PI &&
      Math.hypot(look.leanX, look.leanZ) <= MAX_LEAN &&
      look.tint >= 0.85 &&
      look.tint <= 1.15;
    for (const seed of SEEDS) {
      const trees = samples.get(seed)!;
      expect(trees.length).toBeGreaterThan(0);
      expect(trees.filter((t) => !inRange(t.look)).map((t) => ({ seed, ...t.look }))).toEqual([]);
    }
  });

  it('makes 1 to 4 % of trees dead', () => {
    for (const seed of SEEDS) {
      const dead = shares(samples.get(seed)!)[TreeSpecies.Dead];
      expect(dead).toBeGreaterThanOrEqual(0.01);
      expect(dead).toBeLessThanOrEqual(0.04);
    }
  });

  it('puts pines highest, birches lowest and oaks in between', () => {
    for (const seed of SEEDS) {
      const sorted = [...samples.get(seed)!].sort((a, b) => a.altitude - b.altitude);
      const third = Math.floor(sorted.length / 3);
      const low = sorted.slice(0, third);
      const middle = sorted.slice(third, sorted.length - third);
      const high = sorted.slice(sorted.length - third);
      expect(mostCommon(low), `seed ${seed} low third`).toBe(TreeSpecies.Birch);
      expect(mostCommon(middle), `seed ${seed} middle third`).toBe(TreeSpecies.Oak);
      expect(mostCommon(high), `seed ${seed} high third`).toBe(TreeSpecies.Pine);
    }
  });
});
