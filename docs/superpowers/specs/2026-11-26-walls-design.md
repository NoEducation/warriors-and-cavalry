# Walls Stage — Walls, Gates, Towers

Date: 2026-11-26
Status: draft, waiting for review (builder check done 2026-11-26)
Builds on: `2026-11-25-peasants-design.md` and `AGENTS.md` (all of their rules
still apply unless this document changes them).

## Intent

The player can shape a castle: drag stone walls around the camp, leave gates
for the peasants, and raise towers. There are no enemies yet, so walls and
towers matter as structure: they block movement, cost stone, and make the
castle look like a castle. The owner asked for the simplest version; the
military stage will give them a purpose.

## Goals

- A Wall tool: press, drag and release on the map to build a straight run of
  one-tile wall pieces; a plain click builds one piece.
- A Gate: a one-tile wall piece peasants can walk through.
- A Tower: a 2 × 2 stone building, taller than walls.
- Walls, gates and towers cost stone, block building placement, and walls and
  towers block peasants like any building.

## Non-goals (later stages)

Enemies, soldiers on walls or towers, gates that open and close, wall
thickness or height levels, stairs, damage and repair, dragging to demolish,
replacing a wall piece with a gate in place, rotating gates.

## Anti-goals

- A walled camp whose peasants cannot reach work or storage without the
  player understanding why. (Gates exist for this; the existing
  `worker cannot reach` hover status explains it.)
- Diagonal wall runs that leave gaps a peasant can squeeze through. (Peasants
  never cut corners: a diagonal step needs both side tiles walkable, so a
  diagonal run of pieces touching corner to corner already has no gap.)
- A wall drag that changes the world in more than one command, or a command
  that is not plain data.

## Approaches considered

- **A. One-tile wall pieces placed by dragging (chosen by the owner).** Each
  wall tile is its own small building; a drag sends one "build wall line"
  command that places every tile along the line that is free and affordable.
  Reuses occupancy, pathfinding, ghosts and demolish as they are.
- **B. Walls as line objects (start and end).** Neater long walls, but partial
  demolish, crossings and partial placement all need special handling.
  Rejected: more code for the same result.
- **C. Click each wall tile.** Least new code, but dozens of clicks per wall.
  Rejected: defeats the point of walls.

## Design (decided)

### New object kinds

| Kind | Footprint | Cost | Walkable | Terrain |
|---|---|---|---|---|
| Wall | 1 × 1 | 2 stone | no | Grass, Sand or Rock |
| Gate | 1 × 1 | 6 stone | yes | Grass, Sand or Rock |
| Tower | 2 × 2 | 20 stone | no | Grass, Sand or Rock |

*(Costs and terrain: builder call.)* They store nothing, produce nothing and
house nobody. They are buildable and demolishable; demolishing refunds half
the cost rounded down, as for every building (a Wall refunds 1 stone).

- **Terrain:** these three kinds may also stand on `Rock`, so castles can be
  built on hills. All other buildings keep their current rule. Stored in the
  `OBJECT_KINDS` table as a new flag (for example `rockAllowed`).
- **Steepness:** the allowed height difference across a footprint becomes
  `max(0.6, 0.3 × the longer side)`, so a one-tile piece may stand on ground
  as uneven as a 2 × 2 building. Kinds of 2 × 2 and larger are unchanged.
  *(Builder call; at 0.3 most hill tiles would refuse a wall.)*

### Walkability

- A Gate tile is walkable, like a tree tile. A Wall or Tower tile is not.
- Nothing else changes in pathfinding: peasants route through gates and
  around walls on their own.

### The wall line command

- New command `{ type: 'placeWallLine', fromTx, fromTy, toTx, toTy }`, plain
  data like the others.
- **Tiles of the line:** the standard Bresenham line from `from` to `to`
  (8-connected: a step may be diagonal). Because peasants never cut corners,
  a diagonal run is still closed, and it costs half the stone of a staircase.
  Bresenham's own error rule settles exact ties, so the same `from` and `to`
  always give the same tiles; swapping them may give a different staircase on
  shallow slopes, which is accepted. *(Builder call, revised after the builder
  check; replaces a 4-connected line.)*
- **Length limit:** at most 64 tiles; a longer drag is cut to its first 64
  tiles from `from`.
- **What gets placed:** walking the tiles from `from` to `to`, each tile that
  passes the Wall placement rules is placed and paid for (2 stone). Tiles that
  fail a rule (occupied, water, too steep) are skipped, not an error. At the
  first valid tile that cannot be paid for, placing stops.
- **Result:** `{ ok: true, placed, skipped, unpaid }` when at least one piece
  was placed: `skipped` counts the walked tiles that failed a rule before
  placing stopped; `unpaid` counts the valid tiles from the stopping tile to
  the end of the (cut) line. When nothing was placed the command fails:
  with `NotEnoughResources` if any tile was valid but unaffordable, otherwise
  with the first tile's rule reason. Listeners get one `added` change per
  piece, in tile order. *(Builder call.)*
- A plain click with the Wall tool sends a line whose `from` equals `to`.

### Gates and towers

- Placed with a click, like the existing buildings, through the existing
  `placeBuilding` command.
- A gate goes on a free tile. To put a gate in an existing wall, the player
  demolishes one wall piece and places the gate there (or leaves a gap while
  dragging). *(Builder call: simplest; replacing in place is a later stage.)*

### Input and what the player sees

- **Build bar:** three new tools, Wall, Gate and Tower, before Demolish:
  1 Keep, 2 Hovel, 3 Woodcutter, 4 Stockpile, 5 Granary, 6 Quarry, 7 Farm,
  8 Wall, 9 Gate, 0 Tower, and Demolish moves to the key `X`. *(Builder call:
  the number row has ten keys.)*
- **Dragging a wall:** with the Wall tool, pressing the left button on the map
  starts a line at the tile under the cursor; while the button is held, a
  ghost wall follows the line to the tile under the cursor, each piece green
  when it would be placed and red when it would be skipped, and pieces beyond
  what the stone pays for red too. Releasing sends one `placeWallLine`
  command. Escape or a right click while dragging cancels without building.
  The HUD shows the drag's cost, for example `Wall: 12 pieces, 24 stone`.
- Middle-button camera drags keep working; left drags with any other tool do
  nothing, as now.
- **Shapes** (generated in code, one merged mesh per piece as for other
  buildings, stone colours):
  - Wall: a block filling its tile, about 1.6 units tall, with crenellations
    on top, so neighbouring pieces read as one continuous wall.
  - Gate: the same height with an arched opening through it. The renderer
    turns the opening to run across the wall: if a Wall, Gate or Tower stands
    on the gate's west or east side when the gate's mesh is created, the
    passage runs north–south, otherwise east–west. It is not re-turned when
    neighbours change later; the simulation stores no direction. *(Builder
    call.)*
  - Tower: about 3 units tall with a crenellated top.
- Hovering names the piece (`Wall`, `Gate`, `Tower`).

## Left to the builder

- File and class names, and how the line command, line rasterising and the
  drag ghost are split, within `AGENTS.md` rules.
- How the drag ghost is drawn (instanced pieces are expected; a 64-piece drag
  must not create 64 separate meshes per frame).
- Exact shapes and stone shades, as long as wall, gate and tower are easy to
  tell apart at the default zoom.

## Testing

- Line tiles: horizontal, vertical, a 45° diagonal and a shallow slope give
  the expected Bresenham tiles (consecutive tiles always neighbours, no tile
  twice); `from = to` gives one tile; the 64-tile cut keeps the tiles nearest
  `from`; the same inputs always give the same tiles.
- A peasant cannot pass a diagonal wall run.
- Command: places only free, valid tiles and reports `placed`, `skipped` and
  `unpaid`; spends 2 stone per piece; stops at the first unaffordable tile; a
  line with an occupied first tile, later valid tiles and no stone fails with
  `NotEnoughResources`; a line with no valid tile fails with the first tile's
  reason; a failed line changes nothing; one
  listener call per piece; the command result and the world are the same on
  two worlds given the same commands (checksum).
- Placement: Wall, Gate and Tower allowed on Rock; other buildings still not;
  the steepness floor of 0.6 for one-tile kinds.
- Walkability: a peasant routes through a gate and not through a wall; a Keep
  fully walled with one gate still gets its supply chain working; with no
  gate, the worker reports `worker cannot reach`.
- Purity and layer tests still pass.

Browser check: drag a wall with the ghost showing green and red pieces and the
cost; release builds it and stone drops; a click builds one piece; a gate in a
gap lets peasants through; a tower stands taller than walls; Escape and right
click cancel a drag; key `X` selects Demolish and removes one piece; no
console errors; frame rate not visibly worse.

## Done when

1. `npm test` and `npm run build` pass.
2. The browser check passes.
3. Code is merged to `main` and pushed, with the repository owner as the only
   author on every commit.
