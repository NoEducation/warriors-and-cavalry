# Quarry ground, and more detailed water and beaches

## 1. Quarry ground

**Goal.** Quarries stand only on a special terrain, quarry ground, that the map generator places where a player would
expect stone: at the foot of a mountain, on a small, nearly flat shelf, and that is easy to spot from the camera.

**Terrain.** A fifth tile type, `TileType.Quarry` ("Quarry ground"), stored in `GameMap.tiles` like the others.

**Generation** (`src/sim/QuarrySites.ts`, after the heights, before tiles are classified):

1. A candidate is a `QUARRY_CONFIG.siteSize` square (5 x 5) block of tiles that would be Grass, whose corner height
   range is small enough to flatten without a cliff, and whose ring of neighbouring tiles contains enough Rock from
   a real mountain (rock tiles standing at least `mountainRise` above the block). That is "the bottom of a mountain".
2. Candidates are visited in a seed-hashed order and taken greedily while they keep `minSpacing` tiles from every
   site already taken, up to `maxSites`. So sites spread across the island's mountains and every map has a few.
3. Each taken block is the site's flat **core**: its corners blend to the block's mean height (a small tilt is kept
   so it does not look like a table), so a 3 x 3 quarry always fits there.
4. **Organic shape.** From the core the site grows outward up to `growRadius` tiles, through tiles that would be
   Grass or low Rock, keeping a tile when seed noise minus its distance from the core passes a threshold, with a
   bonus for tiles next to the mountain. The result is an irregular lobe that bites into the mountain foot, not a
   square. Grown corners ease halfway towards the core's plane, so the ground slopes into the shelf instead of
   stepping. Then all tiles are classified as before, and the site's tiles become Quarry. Trees grow only on Grass,
   so quarry ground stays clear.

**Placement.** `ObjectKindInfo.needsRock` is replaced by `quarryOnly`: every footprint tile of a Quarry must be quarry
ground, and no other building may use quarry ground (they fail with `BadTerrain` there). A Quarry placed elsewhere
fails with the new `NeedsQuarryGround` reason, and the build bar says "needs quarry ground". The `NeedsRock` check and
reason go away. Each 512 x 512 map gets up to 14 sites, at least 34 tiles apart.

**Look.** Pale, warm limestone: cut slabs of varying brightness inside the site, ochre patches, and no hard outline.
Every terrain corner that touches quarry ground takes the average colour of the tiles around it, so quarry ground
fades into the rock and grass around it instead of stopping at a line. The hover readout names it "Quarry ground".

## 2. Water, sea and beaches

- **Water surface** (`WaterLayer`, replacing `WaterMeshBuilder`): one plane with a small shader. A depth texture made
  from the corner heights colours the sea: turquoise over shallows, deep blue offshore, and a white foam line where
  water meets the shore that pulses gently with time. Opacity grows with depth, so the seabed shows through near the
  beach. Slow moving ripples and sparkle break up the flat surface.
- **Seabed:** sandy near the shore, darkening and turning greener with depth.
- **Beaches:** dry sand gets dune mottling and pebble specks; a darker tide line sits just above the wet band.

All of this is render-only except section 1. Map generation stays a pure function of `{ seed, width, height }`.
