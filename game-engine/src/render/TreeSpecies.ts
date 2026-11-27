// Tree species drawn by the TreeLayer, with their base sizes and colours. Purely visual: the simulation knows only "tree".

export const TreeSpecies = { Pine: 0, Oak: 1, Birch: 2, Dead: 3 } as const;
export type TreeSpecies = (typeof TreeSpecies)[keyof typeof TreeSpecies];

/** Every species, in id order. */
export const ALL_TREE_SPECIES: readonly TreeSpecies[] = Object.freeze([
  TreeSpecies.Pine,
  TreeSpecies.Oak,
  TreeSpecies.Birch,
  TreeSpecies.Dead,
]);

/** Static description of a species at scale 1, in world units and sRGB hex colours. */
export interface TreeSpeciesInfo {
  readonly name: string;
  /** Total height from the ground to the top of the crown (or of the trunk for a dead tree). */
  readonly height: number;
  /** Widest horizontal radius of the crown (branch reach for a dead tree). */
  readonly crownRadius: number;
  readonly trunkColor: number;
  /** Foliage colour; for a dead tree, the colour of its bare branches. */
  readonly crownColor: number;
}

export const TREE_SPECIES: Readonly<Record<TreeSpecies, TreeSpeciesInfo>> = Object.freeze({
  // Autumn: near-black pines, rust oaks, birches turned dull gold, and grey dead wood.
  [TreeSpecies.Pine]: { name: 'Pine', height: 1.9, crownRadius: 0.55, trunkColor: 0x4a3220, crownColor: 0x1f3824 },
  [TreeSpecies.Oak]: { name: 'Oak', height: 1.4, crownRadius: 0.68, trunkColor: 0x463222, crownColor: 0x8a4a1e },
  [TreeSpecies.Birch]: { name: 'Birch', height: 1.8, crownRadius: 0.4, trunkColor: 0xbab4a6, crownColor: 0xb08428 },
  [TreeSpecies.Dead]: { name: 'Dead tree', height: 1.3, crownRadius: 0.4, trunkColor: 0x5a534a, crownColor: 0x4e4740 },
});
