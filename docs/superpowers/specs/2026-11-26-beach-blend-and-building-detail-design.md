# Beaches that fade into grass, and more detailed buildings

Two render-only changes. Nothing under `src/sim/` changes: tile types, placement rules and map generation stay as
they are, and a map is still its seed.

## 1. Beach to grass edge

**Why.** Sand already slides into the sea through wet sand and a sandy seabed, but the edge between beach and grass
runs along tile borders. Each tile type colours its own corners (`terrainVertexColor`), so the edge reads as rough
squares. It should be a soft, slim, curving transition like the one at the waterline.

**Approach (chosen: colour by height, shared by both sides).** Sand and Grass corners take their colour from one
formula that depends only on the corner (its height and seed noise), not on which tile type is asking. A corner on
the border then gets the same colour from both tiles, so the square seam disappears. The edge follows the height
contour of the coast, so it curves with the land.
*Considered and dropped:* a per-pixel blend in a custom terrain shader. It gives the smoothest edge, but needs a new
terrain material, and at the reduced pixel resolution it adds little over a per-corner blend.

**Design.**
- `shoreColor.ts` gets `beachGrassBlend(map, cx, cy): number`: 0 is pure beach, 1 is pure grass. It is
  `smooth(low, high, h + jitter)` around `MAPGEN_CONFIG.seaLevel + MAPGEN_CONFIG.sandBand`, where `jitter` is coarse
  fbm noise that makes the edge wobble, plus fine noise that frays it into grass tufts on the sand and sandy spots in
  the grass.
- Sand and Grass corners both compute the sand colour and the grass colour and mix them by the blend. Wet sand, the
  tide line and pebbles stay where they are today, because they sit below the blend band.
- The tuning (band width, jitter strength and noise scales) lives in `SHORE_LOOK_CONFIG`.
- Rock, quarry ground and the seabed are unchanged. Quarry blending keeps working, because it averages
  `terrainVertexColor` per tile type.

**Tests (written first).** On a synthetic map with a sand tile beside a grass tile, a shared border corner gets the
same colour from both types. Low corners are beach colour and high corners are grass colour. Corners inside the band
fall between the two. The blend is the same on every run of the same seed.

## 2. More detailed buildings

**Why.** Each building is 3 to 12 plain boxes in one flat colour each, so it looks flat. The owner wants richer
surfaces and more interesting shapes.

**Approach (chosen: more geometry plus shade variation).** Use a shared kit of detail parts, give each shape a more
varied outline, and build surface depth from parts in slightly different shades.
*Considered and dropped:* textures drawn in code. They break the flat-shaded vertex-colour style of the terrain and
trees, the reduced resolution blurs them, and they do nothing for the shape.

**Constraints kept.**
- Each building is still one merged, vertex-coloured, flat-shaded Lambert mesh (one draw call).
- No asset files. Every model stays inside its footprint and keeps its foundation 1.5 below the floor.
- Details must be chunky enough to survive the pixel renderer. As a rule of thumb nothing is thinner than about
  0.05 world units, and the main features are about 0.1 or more.
- `StockpileStacks` and `FarmCrops` still draw on the same deck top and soil top
  (`StockpileShape.deckTop/deckInset`, `WheatFarmShape.soilTop/fieldInset`). The deck and the field inside the fence
  stay clear for them.
- A Gate's passage stays open at mid-height, and Walls and Gates still fill their tile exactly so neighbours join.
- The front of a building is the high-z side, which faces the default camera. Doors and most details go there.
- **Triangle budget** (my call, which replaces the current flat limit of 150): a Wall stays at 150 or under, because
  hundreds get built. A Gate stays at 400 or under. Every other building stays at 1500 or under.

**Shared kit** (new files under `src/render/buildings/`, each under about 150 lines):
- `detailParts.ts`: a door with its frame and lintel, a shuttered window, an arrow slit, timber framing (corner posts
  and beams on a wall box), a stone plinth course, and a chimney.
- `roofParts.ts`: the gable roof (moved from `shapeParts`), a lean-to roof, a thatch roof built from two stacked,
  offset layers with a ridge cap, and a pyramid roof.
- Stone courses: a wall box split into horizontal bands whose shades vary slightly, from a fixed hash (`hash2` with a
  salt per part), so every building of a kind looks the same and the result is deterministic.
- New colours join `SHAPE_COLORS`: door, shutter, window dark, roof ridge, banner red, rope, plaster.

**Per building** (outline, then surfaces):
- **Hovel (2 x 2):** plaster walls on a stone plinth with dark timber framing. A door and frame at the front, a
  shuttered window on a side, and a thick two-layer thatch gable roof with a ridge cap and overhang. A stone chimney,
  and a small lean-to wood store on one side.
- **Woodcutter's hut (2 x 2):** framed plank walls, a door, a window, and a plank roof with a ridge beam. A log pile
  built from stacked round logs (low-sided cylinders), plus a chopping block and a saw-horse.
- **Keep (4 x 4):** a battered plinth (a wider bottom course), with the hall body in stone courses, buttresses at the
  corners and the middle of each side, and a string course band. Arrow slits, a crenellated top, and a forebuilding
  with a door and steps at the front. The corner tower rises above the hall with its own band, merlons and a
  flagpole with a red banner.
- **Granary (3 x 3):** stilts with cross bracing and a plank store with vertical battens. A door reached by a ramp,
  a gable vent, and a layered straw roof with a ridge cap. A few grain sacks stand by the ramp.
- **Stockpile (3 x 3):** a deck of alternating-shade boards with edge beams, and corner posts with caps joined by a
  top rail. The deck surface stays flat for the stacks.
- **Quarry (3 x 3):** an irregular rock face built from offset blocks of varying shade, with ledges, a timber
  scaffold and ladder, and a hoist with a rope and a hanging block. A handcart and scattered cut blocks.
- **Wheat farm (4 x 4):** a fence with posts along every side at an even spacing, two rails, and a gap for a gate.
  A small scarecrow stands at the corner outside the crop area, and the soil keeps its height.
- **Wall (1 x 1):** a plinth course, a stone body in two courses, a coping lip under the walk, and corner merlons.
  It stays within 150 triangles.
- **Gate (1 x 1):** voussoir stones around the arch, a raised portcullis showing above the opening, and timber door
  leaves folded against the inside of the piers. The passage stays clear at mid-height.
- **Tower (2 x 2):** a battered plinth, a shaft in stone courses, arrow slits on each face, a door at the front,
  corbels under the parapet band, merlons, and a banner.

**Tests.** The existing `BuildingMeshFactory` tests keep passing, with the triangle limit replaced by the per-kind
budget above. New tests cover: each detail-part helper returns geometry inside the box it is given; the stone-course
shades are the same across runs; the Gate passage is still clear at mid-height; and the Stockpile deck and the farm
field still have their stated tops. Looks are checked by eye in the dev server, with screenshots.

**Left to the builder.** Exact sizes, positions and shades of the details, within the constraints above. How to split
files to stay under 150 lines. Whether a detail that does not read at the default camera distance is dropped.

## Order

The beach edge first (small), then the shared kit, then the buildings one at a time, committing after each.
