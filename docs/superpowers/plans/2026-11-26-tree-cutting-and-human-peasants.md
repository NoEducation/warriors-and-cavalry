# Tree Cutting and Human-Looking Peasants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Woodcutters walk to trees, chop them down (leaving a stump that clears), and carry the wood to storage; peasants are drawn as animated low-poly people.

**Architecture:** Simulation: two new peasant states (`toTree`, `chopping`), a `TreeClaims` index, a `WoodcutterTrips` helper beside `WorkerTrips`, a generic `ObjectLifecycle.remove`, and a `Stumps` countdown; `World.tick` fells the trees whose chopping cycle finished. Render: one instanced mesh per body part posed by a pure `peasantPose` function; tree and tree-shadow layers follow removals; a felled tree tips over; a `StumpLayer` draws stumps.

**Tech Stack:** TypeScript (strict), three.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-tree-cutting-and-human-peasants-design.md`

## Global Constraints

- All `AGENTS.md` rules: sim purity (no `three`, DOM, `Date`, `Math` beyond `floor, sqrt, abs, min, max, imul` in `src/sim/`), layer table, explicit modifiers and return types, doc comment on every public method, no `enum`, files under ~150 lines, tunables in frozen config objects, no new dependencies, no asset files.
- `PEASANT_STATES` becomes `['idle', 'toWork', 'working', 'toStore', 'toWorkBack', 'toTree', 'chopping']` (appended).
- `ObjectKind.Stump = 12`: 1 × 1, `buildable: false`, cost `NO_RESOURCES`, walkable like a tree.
- `POPULATION_CONFIG.stumpTicks = 600`.
- Woodcutter production stays `cycleTicks: 100, yield: 2, treeRadius: 8`; one tree gives one batch.
- A woodcutter with no free tree retries after `retryTicks + id % retrySpread` ticks.
- Render animation time is `(world.tickCount + tickFraction) / TICKS_PER_SECOND` seconds, so animation pauses with the game.
- Tree fall lasts 1.5 s. All peasants together use a fixed number of meshes (12), independent of the peasant count.
- Iterate with `npx vitest run <files>`; the gate before the PR is `npm test` and `npm run build`.
- Commits: small, descriptive, no `Co-Authored-By` or tool attribution (AGENTS.md overrides).

## Review Focus

1. **A woodcutter's hut demolished mid-chop** — the worker goes idle, its tree claim is released, the tree stays standing. (Test in Task 3.)
2. **Two woodcutters' huts overlapping one small grove** — each tree is chopped once; neither worker walks to a tree the other felled. (Test in Task 3.)
3. **A tree walled in so no neighbour tile is reachable** — it is never claimed; other reachable trees still are; with none reachable the hut shows `workerCannotReach`. (Test in Task 3.)
4. **Building on a stump's tile** — refused (`Occupied`) until the stump clears, then allowed. (Test in Task 2.)
5. **Determinism across a long woodcutting run** — two worlds from the same seed and commands share the checksum after 5000 ticks, with felling and stumps in play. (Test in Task 4.)

---

### Task 1: Peasant states and transitions for woodcutting

**Files:**
- Modify: `src/sim/PeasantView.ts`, `src/sim/Peasant.ts`, `src/sim/worldChecksum.ts`
- Test: `tests/Peasant.test.ts` (new), `tests/worldChecksum.test.ts`

**Interfaces:**
- Produces: `PeasantView.treeId: number | null` (the claimed tree; null otherwise). `Peasant.headToTree(treeId: number): void` (→ `toTree`), `Peasant.startChopping(): void` (`toTree` → `chopping`), `Peasant.waitAtWork(): void` (→ `working` with `waitToRetry()`), `Peasant.dropTree(): void` (sets `treeId` null, state unchanged). `pickUp` and `goIdle` also clear `treeId`.
- `feedPeasant` feeds `treeId ?? 0` after `targetId`.

- [ ] **Step 1: Write failing tests** in `tests/Peasant.test.ts`: `headToTree(7)` gives `{ state: 'toTree', treeId: 7 }`; `startChopping()` gives `'chopping'` keeping `treeId`; `pickUp(load)` gives `'toStore'`, `treeId: null`; `goIdle()` clears `treeId`; `waitAtWork()` gives `'working'` with `waitTicks === retryTicks + id % retrySpread`. In `tests/worldChecksum.test.ts`: `PEASANT_STATES` ends with `'toTree', 'chopping'` and its first five entries are unchanged.
- [ ] **Step 2: Run** `npx vitest run tests/Peasant.test.ts tests/worldChecksum.test.ts` — expect FAIL (no `headToTree`).
- [ ] **Step 3: Implement** the states, field, transitions and checksum feed; update the doc comments (state list in `PeasantState`, `feedPeasant` field list).
- [ ] **Step 4: Run** the same command — PASS; then `npx vitest run tests/Population.test.ts tests/Supply.test.ts` — still PASS (nothing uses the new states yet).
- [ ] **Step 5: Commit** `sim: peasant states and transitions for walking to and chopping a tree`

### Task 2: Stumps and generic object removal

**Files:**
- Create: `src/sim/Stumps.ts`
- Modify: `src/sim/ObjectKind.ts`, `src/sim/ObjectIndex.ts` (`isWalkable`), `src/sim/ObjectLifecycle.ts`, `src/sim/World.ts`, `src/sim/populationConfig.ts`, `src/sim/worldChecksum.ts`
- Test: `tests/Stumps.test.ts` (new), `tests/ObjectKind.test.ts`, `tests/Population.test.ts` (config values)

**Interfaces:**
- Produces: `ObjectLifecycle.remove(object: MapObject): void` — removes without refund in the fixed order index → capacity → production → population → stumps → listeners; `demolish` becomes "check, `remove`, refund" with the same observable order of capacity then refund (refund after `removeCapacity`, so keep `economy.refund` right after `removeCapacity` by doing the removal steps inline via a private `detach(object, refund: boolean)` if needed).
- `class Stumps { added(object: MapObject): void; removed(object: MapObject): void; tick(): number[] /* ids whose count reached 0, ascending */; ticksLeft(id: number): number /* 0 when not a stump */ }`; `ObjectFollowers` gains `readonly stumps: Stumps`.
- `World.fellTree(treeId: number): void` (private) — removes the tree and adds a `Stump` on its tile in the same tick. `World.stumpTicksLeft(id: number): number` (public, for the checksum).
- `World.tick` order: `ticks++` → `populace.tick()` → `outputs = production.tick(...)` → `felled = populace.collect(outputs)` → `fellTree` each → each id from `stumps.tick()` is `lifecycle.remove`d.
- Checksum: after the skip ticks, each stump's id and ticks left in id order.

- [ ] **Step 1: Write failing tests** in `tests/Stumps.test.ts`, using a test-only path: spawn a `Stump` with `world.spawn(ObjectKind.Stump, 3, 3)`. Assert: `isWalkable(3, 3)` is true; `canPlace(ObjectKind.Hovel, 3, 3)` fails with `Occupied`; `demolish` on it fails `NotDemolishable`; `stumpTicksLeft(id)` is 600, then 599 after one tick; after 600 ticks `objectAt(3, 3)` is undefined, a `removed` change was heard, and placing a Hovel there succeeds. `ObjectKind.test.ts`: Stump is `{ name: 'Stump', width: 1, height: 1, buildable: false }`. `POPULATION_CONFIG` expectation gains `stumpTicks: 600`.
- [ ] **Step 2: Run** `npx vitest run tests/Stumps.test.ts tests/ObjectKind.test.ts tests/Population.test.ts` — FAIL.
- [ ] **Step 3: Implement** Stump kind, walkability, `Stumps`, `remove`, `World` wiring (no felling caller yet; `fellTree` arrives with Task 3) and the checksum feed. Make `BuildingLayer.add` already skip Stump (it is not buildable, so it does).
- [ ] **Step 4: Run** the same command plus `tests/World.test.ts tests/worldChecksum.test.ts tests/Walls.test.ts` — PASS.
- [ ] **Step 5: Commit** `sim: stumps that block building, stay walkable and clear after a minute`

### Task 3: Woodcutters walk to a tree, chop it and fell it

**Files:**
- Create: `src/sim/TreeClaims.ts`, `src/sim/WoodcutterTrips.ts`
- Modify: `src/sim/WorkerTrips.ts`, `src/sim/Population.ts`, `src/sim/Jobs.ts` (status), `src/sim/World.ts`
- Test: `tests/Woodcutting.test.ts` (new); update `tests/Supply.test.ts`, `tests/Population.test.ts`, `tests/PeasantLayer.test.ts`, `tests/worldChecksum.test.ts` where they assumed endless wood

**Interfaces:**
- Consumes: Task 1 transitions, Task 2 `fellTree`/`remove`.
- `class TreeClaims { claim(treeId: number, peasantId: number): void; release(treeId: number): void; isClaimed(treeId: number): boolean }`.
- `class WoodcutterTrips` (constructed by `WorkerTrips` with the same host, walker, jobs and a `TreeClaims`): `atHut(p: Peasant): void` — picks and heads to a tree, else `waitAtWork()`; `tickToTree(p: Peasant): void`; `tickWaiting(p: Peasant): void` — counts the wait down, then `atHut`; `release(p: Peasant): void` — frees `p`'s claim (call before `goIdle`/`pickUp`).
- `WorkerTrips.isWoodcutter(p: Peasant): boolean` — its workplace's `production.treeRadius !== null`. On arrival at the workplace a woodcutter calls `atHut` instead of `startWorking`. `stop`/`giveUpJob` release the claim.
- `Population.isWorking(id)`: true for a `chopping` worker, or a `working` worker whose workplace has no tree radius.
- `Population.collect(outputs): number[]` — the tree ids felled this tick (a chopping worker's `treeId`, read before `carry`), ascending by building id.
- `Population.buildingRemoved(tree)` releases that tree's claim; a `toTree` walker whose tree is gone re-picks on its next tick.
- `Population.withJobStatus`: a woodcutter `working` (waiting at the hut) shows `noTrees`; `toTree` and `chopping` show the building's own status.

Picking a tree (in `WoodcutterTrips`): candidates are `Tree` objects within `treeRadius` (Chebyshev from the footprint, as `Production.inTreeRange`) and not claimed, scanned row by row over the radius box; goals are each candidate's walkable edge neighbours (`host.accessTiles(treeId)`); one `walker.walkTo(p, goals)`; the claimed tree is the first candidate (row order) having the path's end tile among its goals — the same end-tile matching as `WorkerTrips.planDelivery`. No candidates → `waitAtWork()`. Candidates but no path → give the job up (skip, `workerCannotReach`). On arriving at the end of the walk: standing on one of the tree's access tiles → `startChopping`, else re-pick.

- [ ] **Step 1: Write failing tests** in `tests/Woodcutting.test.ts` on a flat 32×32 camp (Keep at (2, 2), hut at (20, 6), stockpile at (10, 12), trees spawned at listed tiles):
  - one tree at (24, 7): the worker reaches `toTree` with `treeId` of that tree, then `chopping` next to it; after the cycle the tree tile holds a `Stump`, the worker is `toStore` with `{ resource: Wood, amount: 2 }`; wood rises by 2 on delivery; the worker returns to the hut.
  - with the one tree felled and none left in range: the worker stands at the hut in `working`, `productionState(hut).status === 'noTrees'`, wood stops rising, and it never leaves the hut over 500 ticks.
  - the nearest tree is chosen: trees at (23, 7) and (27, 7) → the first `treeId` is the (23, 7) tree.
  - two huts at (20, 6) and (20, 10) and three trees between them: across the run every tree is felled exactly once (count `removed` changes per tree id = 1) and at no tick do two peasants share a `treeId`.
  - hut demolished while its worker is `chopping`: the worker goes idle, its tree still stands, and the second hut's worker can later claim that tree.
  - a tree surrounded by walls on all 8 neighbours plus one open tree: the open one is felled, the walled one never claimed; with only the walled tree in range, the hut shows `workerCannotReach`.
  - the claimed tree removed mid-walk (place-blocking it is impossible, so simulate by felling it via a second woodcutter, i.e. the two-hut setup): the walker re-picks without stopping.
- [ ] **Step 2: Run** `npx vitest run tests/Woodcutting.test.ts` — FAIL.
- [ ] **Step 3: Implement** `TreeClaims`, `WoodcutterTrips`, the `WorkerTrips` dispatch (`toTree` → `tickToTree`; `working` + woodcutter + `waitTicks > 0` → `tickWaiting`), `Population` changes, `World.fellTree`. Keep `WorkerTrips.ts` under ~150 lines by putting all tree logic in `WoodcutterTrips`.
- [ ] **Step 4: Run** `npx vitest run tests/Woodcutting.test.ts` — PASS.
- [ ] **Step 5: Run** `npm test`. Fix tests that relied on endless wood: give their huts enough trees, or update the expected amounts with a one-line comment that wood now comes from felled trees. Do not weaken an assertion's meaning.
- [ ] **Step 6: Commit** `sim: woodcutters walk to the nearest free tree, chop it and leave a stump`

### Task 4: Determinism of woodcutting

**Files:**
- Test: `tests/worldChecksum.test.ts`

- [ ] **Step 1: Write the test** "two generated worlds with the same seed and the same commands (Keep, stockpile, two woodcutter's huts in a forest) share the checksum every 500 ticks up to 5000, and at least one Stump exists by then". Find hut tiles from the generated map in the test by scanning for a grass area next to trees (helper in the test file).
- [ ] **Step 2: Run** `npx vitest run tests/worldChecksum.test.ts` — PASS (if it fails, fix the non-determinism in sim code, not the test).
- [ ] **Step 3: Commit** `test: woodcutting stays deterministic over a long run`

### Task 5: Pose maths

**Files:**
- Create: `src/render/peasantPose.ts`
- Test: `tests/peasantPose.test.ts`

**Interfaces:**
- `type PoseActivity = 'idle' | 'walk' | 'carry' | 'work'`.
- `interface PoseInput { activity: PoseActivity; distance: number /* tiles walked, render-side */; time: number /* seconds */; phase: number /* 0..1 from id */ }`.
- `interface Pose { bob: number; lean: number; leftLeg: number; rightLeg: number; leftArm: number; rightArm: number; tool: number }` — angles in radians about the joint's x axis, positive swings forward.
- `peasantPose(input: PoseInput, out: Pose): Pose` — allocation-free.
- `export const PEASANT_POSE_CONFIG` (frozen): `strideTiles: 0.5`, `legSwing: 30°`, `armSwing: 25°`, `bob: 0.02`, `carryLean: 15°`, `carryArm: -40°` (held back), `workPeriod: 1`, `workRaise: 120°`, `idlePeriod: 4`, `idleSway: 2°`.
- `activity` mapping (used by Task 7): `toStore` → carry; moving (`stepTicks > 0`) → walk; `working` (non-waiting) or `chopping` → work; else idle.

- [ ] **Step 1: Write failing tests:** walk: `leftLeg === -rightLeg`, `leftArm` has the opposite sign of `leftLeg`, max |leg| ≈ 30°, pose at `distance` and `distance + 2 * strideTiles` equal; carry: `lean ≈ 15°`, both arms ≤ -30°; work: `rightArm` ranges from ≈0 to ≈120° across one period and repeats with `workPeriod`; idle: |arms| ≤ 2°, legs 0; different `phase` gives a different walk pose at the same distance.
- [ ] **Step 2: Run** `npx vitest run tests/peasantPose.test.ts` — FAIL.
- [ ] **Step 3: Implement** with `Math.sin` of the phase-shifted cycle (render code may use any `Math`).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `render: pose maths for walking, carrying, working and idle peasants`

### Task 6: Body part geometries and looks

**Files:**
- Modify: `src/render/PeasantGeometryFactory.ts` (replace `create`/`createBundle`)
- Create: `src/render/peasantLook.ts`
- Test: `tests/PeasantGeometryFactory.test.ts` (rewrite), `tests/peasantLook.test.ts`

**Interfaces:**
- `export const PeasantPart = { Leg, Arm, Torso, Head, Hat, Hood, LogBundle, StoneBundle, SackBundle, Axe, Pick, Hoe } as const` (values 0..11) and `type PeasantPart`.
- `PeasantGeometryFactory.create(part: PeasantPart): THREE.BufferGeometry` — non-indexed, `position`, flat `normal`, `color`; each part with its joint at the origin: Leg hangs down from y = 0 (hip) to y ≈ -0.3 with a darker shoe; Arm hangs from the shoulder to y ≈ -0.28 with a skin hand; Torso from the waist (y = 0) to the shoulders (≈ 0.3), tapered, belt band, white tunic vertices (tinted per instance); Head from the neck up ≈ 0.17 with eye band and hair; Hat and Hood white (tinted); tools held at the hand, pointing forward (+z) along the handle.
- `export const PEASANT_JOINTS` (frozen, figure space, feet at y = 0): `hip: 0.3`, `hipSide: 0.06`, `waist: 0.3`, `shoulder: 0.58`, `shoulderSide: 0.19`, `neck: 0.6`, `hand: -0.27`.
- `peasantLook(id: number): { tunic: number; headwear: 'hat' | 'hood'; headwearColor: number }` — from `hash2(0x5eed, id, 0)` into palettes `TUNIC_COLORS` (5 muted sRGB values) and `HEADWEAR_COLORS` (3); `toolFor(kind: ObjectKind | undefined): PeasantPart | null` — WoodcutterHut → Axe, Quarry → Pick, WheatFarm → Hoe, else null.

- [ ] **Step 1: Write failing tests:** every part builds non-indexed with colour per vertex and under 80 triangles; Leg `max.y ≈ 0`, `min.y ≈ -0.3`; Arm `max.y ≈ 0`; Torso `min.y ≈ 0`; the assembled heights `hip + leg length ≈ 0.3` and `neck + head + hat ≤ 0.9`; Torso tunic vertices are white (instance tint shows); `peasantLook` is stable per id and spreads 50 ids over at least 4 tunic colours and both headwear kinds; `toolFor` mapping.
- [ ] **Step 2: Run** `npx vitest run tests/PeasantGeometryFactory.test.ts tests/peasantLook.test.ts` — FAIL.
- [ ] **Step 3: Implement** with tapered boxes (move top vertices inward) and merged boxes as the current factory merges them; shapes and colours are the builder's call within the spec.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `render: peasant body parts with joints, tools, load bundles and per-peasant looks`

### Task 7: Animated peasant layer

**Files:**
- Create: `src/render/PeasantRig.ts` (part matrices from body matrix + pose), `src/render/PeasantMeshes.ts` (one instanced mesh per part, capacity growth, show/hide, dispose)
- Modify: `src/render/PeasantLayer.ts`, `src/render/PeasantTracks.ts` (keep distance walked per track; heading toward the tree while `chopping`)
- Test: `tests/PeasantLayer.test.ts` (update), `tests/PeasantRig.test.ts`

**Interfaces:**
- Consumes: `peasantPose`, `PeasantPart`, `PEASANT_JOINTS`, `peasantLook`, `toolFor`, `PeasantView.treeId`.
- `PeasantRig.pose(body: THREE.Matrix4, pose: Pose, out: PeasantPartMatrices): void` where `PeasantPartMatrices` holds `leftLeg, rightLeg, leftArm, rightArm, torso, head, headwear, bundle, tool` as `THREE.Matrix4`.
- `PeasantMeshes.mesh(part: PeasantPart): THREE.InstancedMesh`, `begin(): void`, `push(part, matrix, color?)`, `end(): void`, `ensure(count: number)`, `dispose()`; mesh names `peasant-<part name lower-case>`.
- `PeasantTracks.distance(id: number): number`, and `place` returns the heading toward `objectById(treeId)` while chopping.

- [ ] **Step 1: Write/adjust tests:** `PeasantRig`: with an identity body and zero pose, the left leg's origin is at `(-hipSide, hip, 0)` and the right arm's at `(shoulderSide, shoulder, 0)`; a forward leg swing moves the foot to +z. `PeasantLayer`: legs and arms meshes hold `2 × peasants` instances, torso/head hold `peasants`, hat + hood counts sum to `peasants`; bundle meshes hold one instance per carrier in the mesh matching its resource; an Axe instance exists for the woodcutter while it walks to the tree or chops, none while it carries; a chopping peasant's torso faces its tree (heading within 0.3 rad of the direction to the tree centre); the existing "one tick behind" test keeps passing with the torso mesh; the layer creates exactly 12 instanced meshes regardless of peasant count.
- [ ] **Step 2: Run** `npx vitest run tests/PeasantLayer.test.ts tests/PeasantRig.test.ts` — FAIL.
- [ ] **Step 3: Implement.** Animation time from the Global Constraints; per-instance colours on Torso, Hat and Hood from `peasantLook`. Keep each file under ~150 lines.
- [ ] **Step 4: Run** — PASS; then `npx vitest run tests/layers.test.ts`.
- [ ] **Step 5: Commit** `render: peasants drawn as posed body parts that walk, carry, work and idle`

### Task 8: Trees and shadows follow felling; falling trees; stumps

**Files:**
- Create: `src/render/FallingTrees.ts`, `src/render/StumpLayer.ts`
- Modify: `src/render/TreeLayer.ts`, `src/render/TreeShadowLayer.ts`, `src/render/WorldView.ts`
- Test: `tests/TreeLayer.test.ts`, `tests/TreeShadowLayer.test.ts`, `tests/StumpLayer.test.ts` (new)

**Interfaces:**
- `TreeLayer` and `TreeShadowLayer` keep `Map<treeId, { mesh: THREE.InstancedMesh; index: number }>` and a `WorldChangeQueue`; on a tree's removal the shadow instance gets a zero-scale matrix at once; the tree instance is handed to `FallingTrees`.
- `class FallingTrees { start(mesh: THREE.InstancedMesh, index: number, base: THREE.Matrix4, away: THREE.Vector3, time: number): void; update(time: number): void; get count(): number }` — rotates about the base away from `away` (the nearest peasant's position, else +x) by up to 90° over 1.5 s while sinking by the tree height, then sets a zero-scale matrix and forgets it.
- `class StumpLayer implements WorldLayer` — one instanced mesh named `stumps`, a short trunk with a lighter top, follows additions and removals of `Stump` objects, grows capacity by doubling from 64.

- [ ] **Step 1: Write failing tests:** after a tree is felled in a small world, `TreeLayer.update` at the same render time leaves the instance upright, 0.75 s later it is tilted, after 1.5 s its matrix has zero scale; the shadow instance is zero-scaled at once; `StumpLayer` count is 1 after felling and 0 after `stumpTicks` more ticks; `dispose` frees everything and unsubscribes (a later change does not throw).
- [ ] **Step 2: Run** `npx vitest run tests/TreeLayer.test.ts tests/TreeShadowLayer.test.ts tests/StumpLayer.test.ts` — FAIL.
- [ ] **Step 3: Implement** and add `StumpLayer` to `WorldView`'s layers after `TreeLayer`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `render: felled trees tip over and sink, shadows go with them, stumps show until they clear`

### Task 9: Gate and in-browser check

- [ ] **Step 1:** `npm test` and `npm run build` on the committed HEAD — both green.
- [ ] **Step 2:** `npm run dev`, open http://localhost:5180, place a Keep, stockpile and woodcutter's hut by a forest, speed time up; confirm with screenshots: a peasant walking with swinging limbs, a woodcutter chopping facing its tree, a tree falling, a stump, a carrier with logs, the hut showing "no trees nearby" when its trees are gone; no console errors.
- [ ] **Step 3:** Open the PR with the `pr-description` skill.
