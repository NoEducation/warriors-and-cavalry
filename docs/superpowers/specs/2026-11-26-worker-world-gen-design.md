# World generation in a Web Worker, a loader and a start menu

## Intent

Generating a 512 x 512 map freezes the page: in Node, terrain generation takes about 0.25–0.4 s, tree placement about
0.2 s and the terrain mesh (`TerrainMeshBuilder.buildChunkGeometry`) 1.5–3 s, all on the main thread, at start-up and
on every "New map". The owner wants that work moved to a Web Worker so the page stays responsive, a basic loader shown
while a map is made, and a simple start menu before the game begins.

## Goals

- The heavy, pure parts of making a world run in a worker: corner heights and tile types (`generateTerrain`,
  `classifyTile`, quarry carving), the forest plan (which tiles get a tree), and the terrain chunk vertex data
  (positions, colours, normals from `buildChunkGeometry`).
- Results cross back as transferred typed arrays, not copies.
- The main thread only wraps those arrays: `GameMap`, a `World` with the planned trees spawned, `BufferGeometry` per
  chunk, and the cheap layers (water, trees, buildings…).
- A loading overlay (medieval panel, spinner, current stage) covers the game while a map is made, at start and on
  "New map".
- A start menu: title, seed field (from the URL, else the default), "Random" and "Start". Start writes the seed to the
  URL and loads the map.

## Non-goals

- No change to the generated maps: the same seed gives byte-identical heights, tiles and trees (`worldChecksum`).
- The simulation stays on the main thread; ticking is unchanged.

## Design

- `sim/MapGenerator`: `generateLayout(params) → { map, treeTiles }` (pure, worker-safe) and `buildWorld(layout) → World`;
  `generate` is `buildWorld(generateLayout(params))`. `TreePlacer.plan(map, seed)` lists tree tile indices in
  row-major order; `place` spawns that plan (on a fresh world no tile is taken, so the old `objectAt` check never fired).
- `render/TerrainMeshBuilder`: `buildData(map) → TerrainChunkData[]` (plain typed arrays) and `fromData(chunks) → Group`;
  `build` is `fromData(buildData(map))`. `WorldView.showWorld(world, terrain?)` uses given chunk data.
- `game/WorldGenJob`: runs layout + chunk data for `{ seed, width, height }`, reporting stages; returns serialisable
  `WorldGenResult` and its transfer list. `game/WorldAssembler` turns a result into `{ world, terrain }`.
- `game/worldGen.worker.ts`: the worker entry, one `WorldGenJob` per request.
- `game/WorldLoader`: owns the worker, matches replies by request id, forwards progress; falls back to running the job
  on the main thread (after a frame, so the overlay paints) where `Worker` does not exist (tests, Node).
- `ui/LoadingOverlay`, `ui/StartMenu`: HTML widgets; `game/GameLauncher` wires menu → loader → `Game`.
- `Game` takes its first loaded world in the constructor; "New map" is async, ignored while a load is running.

## Risks

- Worker bundling: Vite's `new Worker(new URL(..., import.meta.url), { type: 'module' })` form.
- Float maths in a worker is the same engine, so maps stay identical; a test compares checksums of both paths.
