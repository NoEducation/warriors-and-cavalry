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
  [TreeSpecies.Pine]: { name: 'Pine', height: 1.9, crownRadius: 0.55, trunkColor: 0x5e3f24, crownColor: 0x24552c },
  [TreeSpecies.Oak]: { name: 'Oak', height: 1.4, crownRadius: 0.68, trunkColor: 0x5a4027, crownColor: 0x3f7a2e },
  [TreeSpecies.Birch]: { name: 'Birch', height: 1.8, crownRadius: 0.4, trunkColor: 0xe4e0d4, crownColor: 0x86b84a },
  [TreeSpecies.Dead]: { name: 'Dead tree', height: 1.3, crownRadius: 0.4, trunkColor: 0x6f655a, crownColor: 0x645a4f },
});
