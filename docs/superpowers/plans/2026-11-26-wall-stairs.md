# Wall Stairs and the Wall Walk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Stairs piece placed against walls, wall and tower tops walkable only by stairs, and idle peasants who climb
up to keep watch.

**Architecture:** Each tile gets a *walk class* (Blocked, Ground, Stairs, Top) from the object on it. A pure step rule
over classes, applied by `PathFinder` from a per-neighbour class array, decides each step under a *walk mode* (Ground,
Climb, Down). Peasants remember the mode of their current walk so blocked-step checks and the checksum agree. Render
reads the same classes for peasant heights and turns a new stairs mesh toward its wall.

**Tech Stack:** TypeScript (strict), three.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-wall-stairs-design.md`

## Global Constraints

- `src/sim/` pure; per-tick loops in ascending id order; no `enum` (use `as const` objects).
- Stairs: `ObjectKind.Stairs = 13`, 1 x 1, castle piece (buildable, rock allowed), cost `resources(0, 3, 0)`.
- New placement failure `NeedsWall`, checked after `Occupied`; build-bar key `KeyT`, label `Stairs`, Castle category.
- Walk height on a wall: floor + `WALL_SIZES.walkHeight` (1.2); on a tower: floor + tower `bandTop` (2.55).
- Lookout searches bounded by `PATH_CONFIG.treeSearchMaxExpanded`.
- Files under about 150 lines; doc comment on every public method; no commit attribution.

## Review Focus

1. A delivery between two sides of a wall with stairs on both sides goes through the gate, never over the wall. (Task 2 test.)
2. A peasant standing on a tile when a wall is built on it is not stuck: it gets down (Down mode). (Task 2 test.)
3. A lookout whose stairs are demolished climbs down and reaches work when given a job. (Task 3 test.)
4. Diagonal wall runs are walkable on top; a diagonal step from wall top to ground never is. (Task 2 test.)
5. No stairs anywhere: idle behaviour and path-search work are unchanged (island stall test still bounded). (Task 2/3.)

---

### Task 1: The Stairs piece and `NeedsWall`

**Files:** `src/sim/ObjectKind.ts`, `src/sim/placementRules.ts`, `src/sim/WorldCommand.ts` (failure union), `tests/World.test.ts`.

- [ ] Failing tests: stairs beside a Wall or Tower place and cost 3 stone; on open ground fail `NeedsWall`; a Wall only diagonal to it is not enough.
- [ ] Implement: `OBJECT_KINDS[Stairs] = { ...CASTLE, name: 'Stairs', width: 1, height: 1, cost: resources(0, 3, 0) }`; in `checkPlacement`, for Stairs, require an edge neighbour that is a Wall or Tower (via a new `objectKindAt(tx, ty)` callback or the existing free check's index — choose the smallest change that keeps `placementRules` pure).
- [ ] Fix any test enumerating all kinds (`World.test.ts` kind table, `Population.test.ts` housing loop, `BuildingMeshFactory.test.ts`) — a placeholder shape is fine until Task 4.
- [ ] Run `npx vitest run tests/World.test.ts tests/Population.test.ts`; commit `sim: a Stairs piece that must stand beside a wall or tower`.

### Task 2: Walk classes, step rules and walk modes

**Files:** Create `src/sim/walkRules.ts`; modify `ObjectIndex.ts`, `World.ts`, `PopulationHost.ts`, `PathFinder.ts`, `PeasantWalker.ts`, `Peasant.ts`, `PeasantView.ts`, `Population.ts`, `worldChecksum.ts`. Tests: `tests/walkRules.test.ts`, `tests/PathFinder.test.ts`, `tests/Woodcutting.test.ts` (island test patches `walkClass`), `tests/WallWalk.test.ts`.

**Interfaces:**
- `WalkClass = { Blocked: 0, Ground: 1, Stairs: 2, Top: 3 } as const`; `WalkMode = { Ground: 0, Climb: 1, Down: 2 } as const`.
- `canStep(from: WalkClass, to: WalkClass, diagonal: boolean, sideA: WalkClass, sideB: WalkClass, mode: WalkMode): boolean` — `from` Blocked counts as Ground (walking off a tile built over). Rules: Ground/Stairs ↔ Ground/Stairs straight, diagonal only if both sides are Ground/Stairs; Stairs → Top straight in Climb only; Top → Stairs straight any mode; Top → Top straight, and diagonal whatever the sides; Top → Ground straight in Down only; nothing else.
- `type WalkClassOf = (tx: number, ty: number) => WalkClass`.
- `ObjectIndex.walkClass(tx, ty): WalkClass` (Water/outside → Blocked; Wall/Tower → Top; Stairs → Stairs; free/tree/stump/gate → Ground; else Blocked). `isWalkable` = Ground or Stairs. `World.walkClass` and `PopulationHost.walkClass`.
- `PathFinder.findWith(start, goals, walkClassOf, mode, maxExpanded): TileCoord[] | null`; `find(start, goals, isWalkable, maxExpanded)` stays, wrapping `findWith` in Ground mode. The start tile's class is read once; each relaxed node's class is cached per search, so one `walkClassOf` call per neighbour, as today.
- `PeasantWalker.walkTo(p, goals, maxExpanded?, mode = WalkMode.Ground)`; on failure in Ground mode from a Top tile it searches again in Down mode. `Peasant.startWalk(path, mode = WalkMode.Ground)`; `walkMode` getter; `PeasantView.walkMode`; checksum feeds it after the path.
- `isNextStepBlocked` uses `canStep` with the peasant's tile, next tile, side tiles and `walkMode`.

- [ ] Failing `walkRules.test.ts`: one case per rule above, both modes; Blocked `from` steps to Ground.
- [ ] Failing `WallWalk.test.ts` (real World): a carrier's trip across a wall with stairs both sides and a gate takes the gate and never stands on a Top tile; a diagonal wall run is walkable in Climb mode end to end via stairs; a peasant whose tile becomes a Wall gets down and walks on.
- [ ] Implement, keeping `PathFinder.ts` under ~150 lines (move goal marking or the heuristic into a helper if needed).
- [ ] Run `npx vitest run tests/walkRules.test.ts tests/WallWalk.test.ts tests/PathFinder.test.ts tests/Woodcutting.test.ts tests/Supply.test.ts tests/worldChecksum.test.ts`; commit `sim: wall tops are walkable from stairs; ordinary trips stay on the ground`.

### Task 3: Lookouts

**Files:** `src/sim/IdleStands.ts` (split a `WallLookouts` helper if it grows), `src/sim/Population.ts`. Test: `tests/WallWalk.test.ts`.

**Interfaces:** `IdleStands.castleChanged(): void` — clears the stand of every idle peasant standing on a Ground tile, so it looks again next tick. Population calls it from `buildingAdded`/`buildingRemoved` for Wall, Tower and Stairs.

- Taking a stand: when any Stairs object exists, first one Climb-mode search (bounded by `treeSearchMaxExpanded`) toward every Top tile no other peasant stands on; take the tile the path ends on. Otherwise, or on failure, the ground ring as today. Ground ring skips Stairs tiles as it skips gates.
- A stand stays valid while its tile's class is Ground (ground stand) or Top (wall stand).

- [ ] Failing tests: with a Keep, a wall and stairs, an idle peasant ends standing on a Top tile; without stairs on the ground; stairs built after it settled → it climbs; a lookout given a job (place a hut) reaches work; demolish the stairs under a lookout's only way down, then give a job → it gets down and reaches work.
- [ ] Implement; run `npx vitest run tests/WallWalk.test.ts tests/Population.test.ts tests/Supply.test.ts`; commit `sim: idle peasants keep watch on the wall walk when stairs lead up`.

### Task 4: Stairs mesh, peasant height, build bar

**Files:** Create `src/render/buildings/StairsShape.ts`, `src/render/stairsFacing.ts`, `src/render/walkHeight.ts`; modify `BuildingMeshFactory.ts`, `BuildingLayer.ts`, `PlacementGhost.ts`, `PeasantTracks.ts` (+ its callers), `src/ui/BuildTool.ts`, `src/ui/icons.ts`/`iconShapes.ts`. Tests: `tests/stairsFacing.test.ts`, `tests/walkHeight.test.ts`, `tests/BuildingMeshFactory.test.ts`, `tests/BuildTool.test.ts`.

**Interfaces:**
- `StairsFacing = 'north' | 'west' | 'east' | 'south'`; `stairsFacing(world, tx, ty): StairsFacing` — the first Wall/Tower edge neighbour in that order, `'north'` when none.
- `BuildingMeshFactory.create(kind, passage?, facing?)`; `StairsShape.build(facing)` — steps rising toward `facing` from the floor to `WALL_SIZES.walkHeight`, on a castle foundation.
- `walkHeight(world, tx, ty): number` — Wall: floor + 1.2; Tower: floor + 2.55 (export `TOWER_SIZES.bandTop` or a shared constant); else `map.tileHeight`. `tickPosition` takes the world (or a height function) instead of the map.

- [ ] Failing tests: facing picks the wall side in the fixed order; the stairs mesh's top is at 1.2 on the facing side and low on the other; `walkHeight` values; build tool table lists Stairs after Tower with `KeyT`.
- [ ] Implement; run the tests above plus `tests/PeasantLayer.test.ts tests/layers.test.ts`; commit `render: stairs climb to the wall walk and peasants are drawn on top of walls`.

### Task 5: Gate and check

- [ ] `npm test` and `npm run build` on the committed HEAD.
- [ ] In the game: wall line with stairs, idle peasants climb and stand on it; a stair faces its wall.
