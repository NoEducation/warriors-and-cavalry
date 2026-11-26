# Earth banks under buildings, trees chopped in stages, a richer quarry

A short design for three small changes asked for together. Stairs on walls are a separate, larger piece and get
their own design.

## Intent

- **Banks.** A building's floor sits at the highest corner under its footprint, so on a slope its downhill side shows
  a tall bare foundation. The owner wants the meeting of building and ground to look smooth.
- **Tree stages.** One tree now gives one batch of 2 wood and falls. The owner wants a tree to give lumber several
  times before it is gone: **four** rounds.
- **Quarry.** The owner wants the quarry's income raised to **8** stone per cycle (from 2).

## Approaches

Banks:

1. **Drawn earth bank (picked).** A sloped skirt mesh around each building, from the floor edge down to the ground a
   little way out. Render only: map heights, placement and walking are unchanged. Cheap and safe for determinism.
2. Flatten the terrain under buildings in the simulation (Stronghold style). Changes `GameMap` heights through a
   command, which affects neighbouring tiles, trees, walking and the terrain mesh rebuild. Much bigger; not needed for
   the look.

Tree stages:

1. **A per-tree count of rounds left in the simulation (picked).** Each finished chopping batch takes one round; the
   tree falls on the last. The renderer draws the tree smaller as rounds are taken.
2. Raise the batch to 8 wood and keep one chop. Same wood, but none of the "several stages" the owner asked for.

## Design

### Earth banks (render)

- Every building gets a bank: a ring of sloped quads around its footprint. The inner edge follows the footprint border
  at the building's floor height; the outer edge lies `bankWidth` (about 0.7 tile, in a render config) out, at the
  terrain height there (`groundHeightAt`), sunk slightly so it never floats. Corners of the ring are filled so the
  bank is closed all round.
- Where the ground is already at the floor, the bank is flat and practically invisible, so no special case is needed.
- Coloured like the terrain under it (the tile's ground colour, a little darker), flat shaded, part of the building's
  group so it is disposed with it. The placement ghost gets no bank (my call: it would flicker with every move).
- Wall pieces get a bank each; banks of neighbouring pieces overlap under the wall, which does not show.

### Trees in four stages (sim + render)

- New tunable `POPULATION_CONFIG.treeChops: 4` (rounds a tree gives before it falls).
- The simulation keeps, per tree id, the rounds already taken (a `TreeChops` class beside `Stumps`, told about added
  and removed objects, iterated in id order). A tree never chopped has none taken, so generation is unchanged.
- When a woodcutter's chopping batch finishes, it carries its wood (still the hut's `yield` of 2) and the tree's count
  goes up by one; only when it reaches `treeChops` does `TreeFelling` turn it into a stump. So a tree gives 8 wood.
- The woodcutter releases its claim after each round, so it (or another) picks the nearest free tree again, which is
  usually the same, already-started tree. To keep woodcutters finishing trees rather than starting many, a started
  tree in reach is searched for first, and untouched trees only when no started one can be reached (my call).
- The world exposes `treeChopsTaken(id)`, and tells listeners with a new change `{ type: 'chopped', object }` so the
  renderer can follow without polling. The checksum includes each tree's chops taken, in id order.
- Render: `TreeLayer` scales a tree's instance by stage (1.0, 0.85, 0.7, 0.55 of its size, tunable) when it hears
  `chopped`, and the fall still starts when the tree is removed.

### Quarry

- `ObjectKind.Quarry` production `yield` becomes 8 (cycle stays 150 ticks). Tests and any text that assume 2 are
  updated.

## Non-goals

- No terrain flattening, no change to where buildings may stand.
- No new tree art per stage beyond the size change.

## Left to the builder

- Exact bank width, colour shade and stage scales (in config objects).
- How the bank mesh is split into files to stay under ~150 lines each.
