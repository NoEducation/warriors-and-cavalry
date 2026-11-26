# Quarry ground and water — plan

Spec: `docs/superpowers/specs/2026-11-26-quarry-ground-and-water-design.md`.

1. `TileType.Quarry` and its name; tests that count tile types cover five values.
2. `QuarrySites` (test-first, `tests/QuarrySites.test.ts`): sites at the foot of mountains, spaced, flat enough for a
   3 x 3 quarry; wired into `MapGenerator`; re-record the world checksum.
3. Placement: `quarryOnly` replaces `needsRock`; update `placementRules`, `BuildController` messages and tests.
4. Render quarry ground in `terrainColor`.
5. `WaterLayer` with a depth texture and shader; seabed and beach colours in `terrainColor`.
6. Browser check, `npm test`, `npm run build`, commit per step.
