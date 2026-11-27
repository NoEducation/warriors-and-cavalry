# Worker Economy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Peasants exist only as workers: each production building gets a worker spawned at the Keep while the housing
limit has room, workers die with their building or when the limit drops, and peasants cost no food.

**Architecture:** `Arrivals` becomes `Housing` (homes, limit, Keep spawn tile, no timer, no food). `Population.tick`
spawns workers for vacant jobs in ascending building id order; `IdleStands`, `WallLookouts` and the `idle` peasant state
go. `WorkerTrips` waits and retries instead of making a worker idle.

**Tech Stack:** TypeScript (strict), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-27-worker-economy-design.md`

## Global Constraints

- `src/sim/` stays pure and deterministic (`tests/simPurity.test.ts`, `tests/layers.test.ts`).
- The world changes only through `World.apply` and `World.tick`; per-tick loops in ascending id order.
- One class per file, explicit modifiers and return types, doc comment on every public method, files under ~150 lines.
- Tests use a real `World`; new rules test-first. Iterate with `npx vitest run <files>`.
- No AI attribution in commits or PR.

## Review Focus

- Two buildings waiting, one place freed by a demolished hut: only the lower-id building gets the worker.
- A Keep removed while others stand: spawning moves to the next-lowest-id Keep; with none, buildings wait (`noWorker`).
- A Hovel demolished while its count was exactly the limit: nobody dies (no off-by-one).
- A worker killed mid-delivery: its load is lost, its tree claim freed (another woodcutter may take that tree).
- A blocked worker reconnecting after the wall is demolished: it resumes without a new spawn.

---

### Task 1: Spawn workers at the Keep up to the housing; no food, no idle pool

**Files:**
- Rename: `src/sim/Arrivals.ts` → `src/sim/Housing.ts` (class `Housing`: no economy, no timer)
- Delete: `src/sim/IdleStands.ts`, `src/sim/WallLookouts.ts`
- Modify: `src/sim/Population.ts`, `src/sim/Jobs.ts`, `src/sim/Peasant.ts`, `src/sim/PeasantView.ts`,
  `src/sim/WorkerTrips.ts`, `src/sim/populationConfig.ts`, `src/sim/World.ts`, `src/sim/worldChecksum.ts`
- Test: `tests/Population.test.ts` (rewrite the arrivals sections), `tests/Peasant.test.ts`, `tests/WallWalk.test.ts`
  (delete `lookouts`), `tests/worldChecksum.test.ts`, `tests/Supply.test.ts`, `tests/Woodcutting.test.ts`,
  `tests/Walls.test.ts`, `tests/PeasantLayer.test.ts` (fix timings and idle expectations)

**Interfaces:**
- Produces: `Housing { housing: number; keep: MapObject | null; spawnTile(): TileCoord | null; buildingAdded; buildingRemoved }`;
  `PopulationSummary { count: number; housing: number }`; `new Peasant(id, tx, ty, workplaceId)` starts in `toWork`;
  `PEASANT_STATES = ['toWork', 'working', 'toStore', 'toWorkBack', 'toTree', 'chopping']`; `Jobs.vacancies(): number[]`
  (ascending, not skipped); `WorkerTrips.dismiss(p)` (frees tree claim and job). `POPULATION_CONFIG` loses
  `arrivalTicks` and `arrivalFoodCost`. `World.arrivalTimer` is gone.

- [ ] **Step 1: Write failing tests in `tests/Population.test.ts`** (`describe('World population: workers')`):
  - `spawns nobody without a Keep` — hut placed, 500 ticks: `population` is `{ count: 0, housing: 0 }`, hut `noWorker`.
  - `spawns a hut's worker at the Keep on the next tick and spends no food` — Keep at (2, 2), hut: after 1 tick,
    count 1, peasant on the Keep's bottom-left access tile `(2, 6)`, `state: 'toWork'`, `workplaceId: hut.id`; food 50.
  - `spawns no more workers than the housing` — Keep + 5 huts: count 4, the four lowest-id huts have workers.
  - `spawns the waiting building's worker on the tick after a Hovel is placed` — continue: place Hovel, 1 tick →
    count 5, fifth hut has a worker.
  - `skips a building it cannot reach from the Keep` — hut inside a rock ring: no peasant, `workerCannotReach`,
    `jobSkipTicks` 200; count stays 0.
  - `POPULATION_CONFIG` equals the stage values without `arrivalTicks`/`arrivalFoodCost`.
- [ ] **Step 2:** `npx vitest run tests/Population.test.ts` — FAIL.
- [ ] **Step 3: Implement.** `Population.tick`: `jobs.tick()`, then for `id of jobs.vacancies()` while
  `count < housing`: `tile = housing.spawnTile()` (break on null), make the peasant with id `nextId`, `jobs.take`,
  plan its walk; on no path release with skip and do not keep the peasant (id not used); else add it and `nextId++`.
  Then tick every peasant with `trips.tick`. `Peasant.takeJob`, `standOn`, `stand`, `goIdle` go; `Jobs.take` only records.
  Remove the stand and `arrivalTimer` from the checksum (update its doc comment).
- [ ] **Step 4:** fix the other listed test files to the new rules (worker appears 1 tick after placement, not 50;
  extra huts get their own workers; no idle states), then `npx vitest run tests` — PASS.
- [ ] **Step 5: Commit** `sim: workers spawn at the Keep for production buildings up to the housing; peasants cost no food and nobody waits idle`.

### Task 2: Workers die with their building and when the limit drops

**Files:** Modify `src/sim/Population.ts`, `src/sim/Jobs.ts`; Test `tests/Population.test.ts`, `tests/Supply.test.ts`

**Interfaces:** Consumes `WorkerTrips.dismiss`, `Jobs.buildingRemoved`.

- [ ] **Step 1: Failing tests:**
  - `removes the worker of a demolished workplace at once` — count drops by 1 on the demolish, its load is not
    delivered (wood unchanged after 300 ticks apart from the refund).
  - `gives the freed place to the next waiting building on the next tick` — Keep + 5 huts, demolish hut 2: the fifth hut
    gets a worker next tick.
  - `kills the newest workers when a Hovel goes` — Keep + Hovel + 8 huts, 1 tick, demolish Hovel: count 4, survivors
    are peasant ids 1–4; huts 5–8 show `noWorker`.
  - `kills nobody when the count still fits` — Keep + Hovel + 3 huts, demolish Hovel: count 3.
  - `frees the tree claimed by a killed woodcutter`.
- [ ] **Step 2:** run — FAIL. **Step 3:** `buildingRemoved`: dismiss and delete the building's worker; `leaveUntilHoused`
  deletes highest id first. **Step 4:** run — PASS. **Step 5: Commit** `sim: workers die with their workplace, and the newest die when the housing drops below them`.

### Task 3: A cut-off worker keeps its job and retries

**Files:** Modify `src/sim/WorkerTrips.ts`, `src/sim/WoodcutterTrips.ts` (doc only if needed), `src/sim/Population.ts`;
Test `tests/Supply.test.ts`, `tests/Woodcutting.test.ts`

- [ ] **Step 1: Failing tests:**
  - `keeps the job of a worker walled off from its workplace and resumes when the wall goes` — worker `toWork`, ring of
    walls placed around the hut: worker keeps `workplaceId`, `waitTicks > 0`, status `workerCannotReach`; demolish a
    wall: it arrives and works; count unchanged throughout.
  - `keeps a woodcutter whose trees are all cut off` — status `noTrees`, still assigned.
- [ ] **Step 2:** run — FAIL. **Step 3:** `giveUpJob` becomes `waitToRetry` in place; `tickToWork` counts the wait down
  and re-plans; `WoodcutterTrips` false → `p.waitAtWork()`. `isStranded` also covers a waiting `toWork`/`toWorkBack`.
  **Step 4:** run — PASS. **Step 5: Commit** `sim: a worker cut off from its way keeps its job and searches again`.

### Task 4: UI shows workers over the limit

**Files:** Modify `src/ui/statusText.ts`, `src/ui/ResourceBar.ts` (title "Workers"), Test `tests/statusText.test.ts`

- [ ] **Step 1:** test `peasantCountText({ count: 3, housing: 8 })` is `'3/8'`. **Step 2:** FAIL. **Step 3:** implement.
  **Step 4:** PASS. **Step 5: Commit** `ui: the resource bar shows workers over the limit, with no idle count`.

### Task 5: Gate and verify

- [ ] `npm test` and `npm run build` on the committed HEAD — both pass.
- [ ] `npm run dev`, http://localhost:5180: place a Keep, a hut → a worker walks from the Keep; 5 huts → 4 workers;
  a Hovel → the fifth spawns; demolish a hut → its worker vanishes. Food does not drop.
