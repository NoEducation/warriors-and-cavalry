# AGENTS.md Conformance Refactor — Plan

Spec: `docs/superpowers/specs/2026-11-26-agents-conformance-design.md`. One commit per step; run the affected tests
after each (`npx vitest run <files>`), the full gate at the end.

1. *(done)* TilePicker takes `THREE.Vector2Like`; `tests/layers.test.ts` enforces the whole layer table.
2. *(done)* `cameraMath` returns named `PanDelta` / `OrbitOffset`; `clamp` documented.
3. *(done)* `GHOST_CONFIG` shared by `PlacementGhost` and `WallLineGhost`.
4. AGENTS.md: ui row reads "`src/sim/` types and read-only data".
5. World per call: `WorldLayer.update(world, tickFraction)`; `BuildingLayer`, `FarmCrops`, `StockpileStacks` queue
   changes and apply them in `update`; `PeasantLayer` reads the world passed to `update`; `WorldView.update(world, …)`;
   `Game` passes its world. Tests: `BuildingLayer`, `FarmCrops`, `StockpileStacks`, `PeasantLayer`.
6. Sim tunables: `PLACEMENT_CONFIG`, `WALL_LINE_CONFIG`, `GAME_TIME_CONFIG`, map generator / mountain salts. Tests:
   `gameTime`, `wallLine`, `WallLineGhost`, `MapGenerator`, `worldChecksum`.
7. Game and input tunables: `GAME_CONFIG` speeds, tick cap, default seed; `INPUT_CONFIG.dragThresholdPx`. Tests:
   `SimulationRunner`, `seed`, `DragTracker`.
8. Render tunables: `TERRAIN_MESH_CONFIG`, `TREE_LAYER_CONFIG`, `TILE_HIGHLIGHT_CONFIG`, `FARM_CROP_CONFIG`,
   `CAMERA_CONFIG.maxPickDistance`. Tests: `TerrainMeshBuilder`, `TreeLayer`, `TreeShadowLayer`, `FarmCrops`.
9. Gate: `npm test`, `npm run build`.
