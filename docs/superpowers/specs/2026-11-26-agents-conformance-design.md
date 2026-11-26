# AGENTS.md Conformance Refactor

Date: 2026-11-26
Status: approved 2026-11-26 (owner chose the options below)
Builds on: `AGENTS.md` (all of its rules still apply; this document changes only the wording of the ui row of the
layer table).

## Intent

Bring every file under `src/` in line with the rules in `AGENTS.md`, without changing what the game does or how a map
looks. An audit of every file (modifiers, return types, doc comments, `enum`, one class per file, file names, layer
imports, world ownership, config objects, file length) found the violations below. Everything else already conforms.

## Decisions

1. **Layer table.** `render/TilePicker` imported `NdcPoint` from `input`; it now takes a three.js `Vector2Like`. The
   layer test enforces the full table: render depends on sim only, input on nothing, ui on sim only. *(done)*
2. **UI and sim.** ui reads sim's data tables (`OBJECT_KINDS`, `RESOURCE_NAMES`) and `formatGameTime`, not only its
   types. The table is reworded to "`src/sim/` types and read-only data" to match.
3. **One owner of the current world.** `BuildingLayer`, `FarmCrops`, `PeasantLayer` and `StockpileStacks` stored the
   `World` they draw. They now take it on each call: `WorldLayer.update(world, tickFraction)` and
   `WorldView.update(world, tickFraction)`. A layer still reads the world in its constructor and subscribes to its
   changes there, but the change listener only queues the change; the next `update(world)` applies it. Buildings,
   stacks and crops therefore appear at the next frame's update instead of during `apply`. A frame always updates
   before it draws, so nothing on screen changes.
4. **Tunables in config objects.** Gameplay and look values move into their area's config object:
   - `PLACEMENT_CONFIG` (slope per tile, minimum slope limit), `WALL_LINE_CONFIG` (longest line),
     `GAME_TIME_CONFIG` (ticks per day, start hour, clock minute step), and the seed salts and wobble samples of
     `MAPGEN_CONFIG` / `MOUNTAIN_CONFIG`, with their values unchanged so every seed gives the same map.
   - `GAME_CONFIG` gains the simulation speeds, the tick cap per frame and the default seed; a new `INPUT_CONFIG`
     holds the drag threshold.
   - Render: `GHOST_CONFIG` (both placement ghosts; *done*), `TERRAIN_MESH_CONFIG`, `TREE_LAYER_CONFIG`,
     `TILE_HIGHLIGHT_CONFIG`, `FARM_CROP_CONFIG`, and the pick distance in `CAMERA_CONFIG`.
   - Not moved, as they are not tunables: `TICKS_PER_SECOND` (fixed by `AGENTS.md`), hash and RNG constants, mouse
     button codes, epsilons, buffer capacities, and shape dimensions of models built in code (buildings, peasant
     figure, tree parts, stockpile stack layout).
5. **File length.** `World`, `StockpileStacks`, `Population` and `PathFinder` are 153–160 lines, within "about 150";
   they are not split.

## Non-goals

Behaviour or look changes; renaming public APIs beyond the moved constants; splitting files for length alone; the
undocumented one-line `Peasant` getters, which implement the documented `PeasantView`.

## Testing

The existing suite covers every moved value (tests that pinned a constant now read it from its config object). Layer
tests call `update(world)` before checking what a change added or removed. Gate: `npm test` and `npm run build`.
