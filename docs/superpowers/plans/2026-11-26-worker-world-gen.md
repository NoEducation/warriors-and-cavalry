# Plan: world generation in a Web Worker, loader and start menu

Spec: `docs/superpowers/specs/2026-11-26-worker-world-gen-design.md`.

1. sim: `TreePlacer.plan`, `MapGenerator.generateLayout` / `buildWorld`; test that `buildWorld(generateLayout(p))`
   matches `generate(p)` by checksum. Commit.
2. render: `TerrainMeshBuilder.buildData` / `fromData`, `WorldView.showWorld(world, terrain?)`; test that data built
   apart gives the same geometry. Commit.
3. game: `WorldGenJob`, `WorldAssembler`, worker entry, `WorldLoader` with main-thread fallback; tests for the job and
   the fallback loader against `MapGenerator.generate`. Commit.
4. ui: `LoadingOverlay`, `StartMenu`, CSS; `seed.ts` gains `parseSeedText` and `writeSeedToUrl`. Commit.
5. game: `GameLauncher`, `Game` takes a loaded world and loads new maps through the loader; `main.ts`, `index.html`.
   Commit.
6. Gate: `npm test`, `npm run build`; check in the browser that the menu, loader and "New map" work and the page
   answers during a load.
