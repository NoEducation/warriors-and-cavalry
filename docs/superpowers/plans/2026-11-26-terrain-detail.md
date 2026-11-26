# Terrain and tree detail — plan

Spec: `docs/superpowers/specs/2026-11-26-terrain-detail-design.md`.

1. `src/render/terrainColor.ts`: `TERRAIN_LOOK_CONFIG` and `terrainVertexColor(map, type, cx, cy, out)`; tests in
   `tests/terrainColor.test.ts` (deterministic, grass stays green, snow only high, steep rock darker than flat rock).
2. `TerrainMeshBuilder` colours each vertex with `terrainVertexColor` plus a per-triangle speckle.
3. `WorldView`: hemisphere light, warmer lower sun, distance fog.
4. `TreeGeometryFactory`: vertical gradient per crown part, extra pine tier; update the triangle budget test.
5. `TreeLayer`: one instanced soft shadow disc per tree.
6. Check in the browser, run `npm test` and `npm run build`, commit per step.
