# Earth Banks, Four-Stage Trees and a Richer Quarry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Smooth the meeting of buildings and sloped ground with a drawn earth bank, make each tree give wood four
times before it falls, and raise the quarry's batch to 8 stone.

**Architecture:** The quarry is a one-value change in `OBJECT_KINDS`. Tree stages are simulation state kept by
`TreeFelling` (rounds taken per tree id), announced through a new `chopped` world change that `TreeLayer` and
`TreeShadowLayer` follow by shrinking the instance. Banks are render only: a geometry function builds a sloped ring
around a footprint, and `BuildingLayer` adds it as a child of each building mesh.

**Tech Stack:** TypeScript (strict), three.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-building-banks-tree-stages-design.md`

## Global Constraints

- `src/sim/` stays pure (no `three`, `Math` limited to floor/sqrt/abs/min/max/imul); per-tick loops in ascending id order.
- Every member has an access modifier, every function an explicit return type, every public method a doc comment.
- Tunables in frozen config objects; files under about 150 lines; one class per file.
- `POPULATION_CONFIG.treeChops = 4`; woodcutter `yield` stays 2 (8 wood per tree); Quarry `yield = 8`, `cycleTicks = 150`.
- Stage scales `[1, 0.85, 0.7, 0.55]` (index = chops taken); bank width 0.7 tile.
- No commit trailers or AI attribution.

## Review Focus

1. A tree whose woodcutter is sent away (hut demolished) mid-tree keeps its rounds taken; the next woodcutter finishes it rather than restarting at 4. (Task 2 test.)
2. Two woodcutters share a forest: a started tree is claimed by only one at a time and still falls after exactly 4 rounds in total. (Task 2 test.)
3. Every existing `change.type === 'added' … else remove` handler must not treat `chopped` as a removal. (Task 3: each handler ignores it; test in `BuildingLayer`/`StumpLayer` tests via a chop.)
4. A building on flat ground gets a bank that adds no visible lip: all bank vertices lie within 0.1 of the floor. (Task 4 test.)
5. A building at the map edge: bank points outside the map use the nearest edge heights, no NaN. (Task 4 test.)

---

### Task 1: Quarry yields 8

**Files:** Modify `src/sim/ObjectKind.ts` (Quarry production), `tests/World.test.ts:69`, and any test that assumes 2 stone per quarry batch (`npx vitest run` will show).

- [ ] Change the expected Quarry production in `tests/World.test.ts` to `yield: 8`; run `npx vitest run tests/World.test.ts`, expect FAIL.
- [ ] Set Quarry `yield: 8`; run the test, expect PASS; run `npx vitest run tests/Production.test.ts tests/Supply.test.ts` and fix assumptions of 2.
- [ ] Commit: `sim: a quarry batch is 8 stone`.

### Task 2: Trees give four rounds of wood (sim)

**Files:**
- Modify: `src/sim/populationConfig.ts` (add `treeChops: 4`), `src/sim/TreeFelling.ts`, `src/sim/WorldCommand.ts` (`WorldChange.type` adds `'chopped'`), `src/sim/World.ts`, `src/sim/WoodcutterTrips.ts`, `src/sim/worldChecksum.ts`
- Test: `tests/TreeFelling.test.ts` (new or existing), `tests/Woodcutting.test.ts`, `tests/worldChecksum.test.ts`

**Interfaces:**
- Produces: `World.treeChopsTaken(objectId: number): number` (0 for untouched trees and non-trees);
  `WorldChange { type: 'added' | 'removed' | 'chopped'; object }`, `chopped` sent for a tree that took a round and still stands.
- `TreeFelling` constructor gains `listeners: Listeners<WorldChange>`; `fell(treeIds)` becomes `chop(treeIds)`: for each tree, rounds taken + 1; at `treeChops` it is removed (its count forgotten) and a stump added, else a `chopped` change is sent. `chopsTaken(id): number`.

- [ ] Write failing tests in `tests/Woodcutting.test.ts`:
  - `a tree gives four batches of wood before it falls`: one tree, one hut; after the first batch reaches storage, `world.objectAt(24, 7)` is still the tree and `treeChopsTaken(tree.id) === 1`; tick until it is a Stump; total wood gained is `8`.
  - `a woodcutter finishes a started tree before an untouched one`: trees at equal path distance; after the first chop, the next `treeId` is the same tree.
  - `a started tree keeps its rounds when its woodcutter leaves`: after 2 rounds demolish the hut, place a new one; the tree falls after 2 more rounds.
  - `two woodcutters fell a tree after four rounds in total`.
  - Update the existing tests that expect a stump after one chop (lines 61, 114, 132, 142) to tick until the stump appears.
- [ ] Run `npx vitest run tests/Woodcutting.test.ts`; expect FAIL.
- [ ] Implement: chops map in `TreeFelling` (`Map<number, number>`, ids in ascending insertion only matters for the checksum, which iterates `world.objects()`); World calls `felling.chop(...)` and exposes `treeChopsTaken`.
- [ ] In `WoodcutterTrips.pickTree`: search first among candidates with `treeChopsTaken > 0`; if none or none reachable, search all candidates.
- [ ] Checksum: after stumps, feed `(id, chopsTaken)` for each object with chops taken > 0; update its doc comment; add a test that two worlds differing only by a round taken differ in checksum.
- [ ] Run `npx vitest run tests/Woodcutting.test.ts tests/worldChecksum.test.ts tests/Supply.test.ts`; expect PASS.
- [ ] Commit: `sim: a tree gives four rounds of wood before it falls; woodcutters finish started trees first`.

### Task 3: Trees drawn smaller per stage (render)

**Files:** Modify `src/render/TreeLayer.ts`, `src/render/TreeShadowLayer.ts`, and the `added … else` handlers in `BuildingLayer.ts`, `FarmCrops.ts`, `StockpileStacks.ts`, `StumpLayer.ts` (handle `removed` explicitly, ignore `chopped`). Test: `tests/TreeLayer.test.ts`.

**Interfaces:** Consumes `WorldChange` `chopped` and `World.treeChopsTaken`. `TREE_LAYER_CONFIG.stageScales: [1, 0.85, 0.7, 0.55]`.

- [ ] Failing test: after a tree takes one round, its instance matrix's scale is 0.85 of the original (and the shadow's too); a building layer still shows every building after a `chopped` change.
- [ ] Implement: on `chopped`, recompose the slot's matrix from the tree's appearance times `stageScales[chopsTaken]` (keep the base matrix per slot, or rebuild with `treeMatrix`); the fall starts from the scaled matrix. Shadow disc scaled the same.
- [ ] Run `npx vitest run tests/TreeLayer.test.ts tests/TreeShadowLayer.test.ts tests/BuildingLayer.test.ts`; expect PASS.
- [ ] Commit: `render: trees shrink with each round chopped`.

### Task 4: Earth banks under buildings (render)

**Files:** Create `src/render/buildingBank.ts`; modify `src/render/BuildingLayer.ts`. Test: `tests/buildingBank.test.ts`.

**Interfaces:**
- `BANK_CONFIG = { width: 0.7, sink: 0.06, innerDrop: 0.02, colors: { grass, sand, rock, quarry } }` (frozen).
- `bankGeometry(map: GameMap, kind: ObjectKind, tx: number, ty: number, floor: number): THREE.BufferGeometry` — positions relative to the building origin `(tx, floor, ty)`.
- `bankMesh(map, kind, tx, ty, floor): THREE.Mesh` — the geometry with a flat-shaded Lambert material coloured by the tile type at `(tx, ty)`.

Geometry: walk the footprint border tile edge by tile edge; each edge gives a quad from the inner edge (y = `-innerDrop`) to the same edge pushed `width` outward; each corner gives two triangles to the diagonal outer corner. Outer y = `min(ground - sink, -innerDrop) `, where ground is the bilinear height of the map corners at that point, clamped to the map, minus `floor`. Triangles wind so the bank faces outward/up.

- [ ] Failing tests: flat map → every vertex y within 0.1 of 0; footprint on a slope → outer vertices on the downhill side lie below `-0.5`; vertex count is `(perimeter edges + 4 corners) * 6` (non-indexed); building at (0, 0) gives finite positions; every face normal has y ≥ 0.
- [ ] Run `npx vitest run tests/buildingBank.test.ts`; expect FAIL.
- [ ] Implement `buildingBank.ts`; in `BuildingLayer.add` add `bankMesh(...)` as a child of the building mesh (disposed with it by `disposeObject`).
- [ ] Run `npx vitest run tests/buildingBank.test.ts tests/BuildingLayer.test.ts`; expect PASS.
- [ ] Commit: `render: an earth bank slopes from each building's floor down to the ground`.

### Task 5: Gate and check

- [ ] `npm test` and `npm run build` on the committed HEAD; both pass.
- [ ] Look at it in the dev server: a building on a slope shows a bank; a tree shrinks after each round and falls on the fourth.
