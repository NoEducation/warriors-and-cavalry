# Stage 2 — Class Refactor, Larger Map, Trees and Buildings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the code into classes, grow the map to 512 × 512 at 60 FPS, and add generated trees plus player-placed buildings.

**Architecture:** `src/sim/` stays deterministic and free of three.js/DOM; it gains a `World` (map + objects + occupancy) that changes only through serialisable commands. `src/render/` draws the world (chunked terrain, instanced trees, building meshes, placement ghost). `src/input/` and `src/ui/` hold keyboard/pointer and HTML widgets. `src/game/` owns the frame loop and connects the layers.

**Tech Stack:** Node 26, TypeScript 7 (strict), Vite 8, Three.js 0.187, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-11-12-stage2-world-objects-design.md` — read it before starting any task. It builds on `docs/superpowers/specs/2026-11-11-stage1-map-design.md`.

## Global Constraints

- Project root: `D:\Projekty\warriors-and-cavalry`. Work on branch `stage2-world-objects`. Never push; never touch `main`.
- No new dependencies.
- One class per file, file named after the class (`Game.ts`). Stateless math stays as exported functions in camelCase files.
- Every class member has an explicit `public`, `private` or `readonly` modifier; every method and function has an explicit return type.
- Data passed between classes is described by a named `interface` or type alias.
- Every public method has a doc comment: what it does and when to call it.
- No factory functions returning object literals; no `enum` keyword (use `as const` objects).
- Nothing under `src/sim/` may import `three`, touch `document`/`window`, use `Date`, `performance`, `crypto`, or any `Math` member other than `floor`, `sqrt`, `abs`, `min`, `max`, `imul`. `tests/simPurity.test.ts` enforces this and must keep passing.
- Render, UI and game code never mutate a `GameMap` or `World` directly; the only mutating call after generation is `World.apply(command)`.
- World coordinates: tile `(tx, ty)` covers `x ∈ [tx, tx+1]`, `z ∈ [ty, ty+1]`; `y` is height.
- No image, model or audio asset files.
- Each source file stays under about 150 lines.
- `npm test` and `npm run build` must pass before every commit. Commit after each task; end every commit message with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Review Focus

1. **Building footprint hanging over the map edge** (hover at `tx = 511` with a 4 × 4 Keep) — rejected as `OutOfBounds`, ghost red, no exception. (Task 4 test; Task 7 browser check.)
2. **Ray that never meets the ground** (horizontal, pointing up, zero-length or NaN direction) — picking returns no tile and terminates; no endless loop. (Task 2 tests.)
3. **"New map" while a build tool is active** — the tool keeps working on the new world; nothing is placed into the old one; no leftover building meshes or ghost. (Task 7 test and browser check.)
4. **Click that is not on the map** (cursor off the terrain, or over the HUD/build bar) with a tool active — nothing is placed and nothing throws. (Task 7 test.)
5. **Demolish on a tree, an empty tile or an id that no longer exists** — rejected with a reason; world unchanged. (Task 4 tests.)

---

### Task 1: Class refactor (behaviour unchanged)

**Files:**
- Create: `src/game/Game.ts`, `src/game/GameConfig.ts`, `src/game/FpsCounter.ts`, `src/game/TileHover.ts`, `src/input/Keyboard.ts`, `src/input/Pointer.ts`, `src/ui/Hud.ts`, `src/render/WorldView.ts`, `src/render/TerrainMeshBuilder.ts`, `src/render/WaterMeshBuilder.ts`, `src/render/TileHighlight.ts`, `src/render/TilePicker.ts`, `src/render/disposeObject.ts`, `src/sim/TileCoord.ts`, `tests/FpsCounter.test.ts`
- Rename: `src/sim/map.ts` → `src/sim/GameMap.ts`; `src/sim/mapgen.ts` → `src/sim/MapGenerator.ts`; `src/render/pixelRenderer.ts` → `src/render/PixelRenderer.ts`; `src/render/cameraRig.ts` → `src/render/CameraRig.ts`; `src/seed.ts` → `src/game/seed.ts`; `tests/map.test.ts` → `tests/GameMap.test.ts`; `tests/mapgen.test.ts` → `tests/MapGenerator.test.ts`; `tests/keyState.test.ts` → `tests/Keyboard.test.ts`
- Delete (replaced by the classes above): `src/render/keyState.ts`, `src/render/hud.ts`, `src/render/highlight.ts`, `src/render/picking.ts`, `src/render/terrainMesh.ts`, `src/render/water.ts`
- Modify: `src/main.ts` (rewrite), all tests (imports and names)

**Interfaces:**
- Produces:
  - `GAME_CONFIG = Object.freeze({ mapSize: 128, pixelScale: 3, fpsSamples: 60, fpsUpdateMs: 500 })` in `GameConfig.ts`. `PixelRenderer` takes the pixel scale from its constructor.
  - `interface TileCoord { readonly tx: number; readonly ty: number }`
  - `class MapGenerator { public generate(params: MapParams): GameMap }`; `MAPGEN_CONFIG` and `mapChecksum(map)` stay exported from `MapGenerator.ts`.
  - `class Keyboard { constructor(target: EventTarget); public isDown(code: string): boolean; public dispose(): void }`
  - `interface NdcPoint { readonly x: number; readonly y: number }`; `class Pointer { constructor(canvas: HTMLCanvasElement); public get ndc(): NdcPoint | null; public dispose(): void }`
  - `class Hud { constructor(root: HTMLElement, onNewMap: () => void); public setSeed(seed: number): void; public setTile(info: HudTileInfo | null): void; public setFps(fps: number): void }`
  - `class PixelRenderer { constructor(canvas: HTMLCanvasElement, pixelScale: number); public readonly webgl: THREE.WebGLRenderer; public resize(): RenderSize | null; public render(scene: THREE.Scene, camera: THREE.Camera): void }`
  - `class TerrainMeshBuilder { public build(map: GameMap): THREE.Mesh }`; `class WaterMeshBuilder { public build(map: GameMap, seaLevel: number): THREE.Mesh }`; `disposeObject(root: THREE.Object3D): void` (disposes geometries and materials of every mesh under `root`).
  - `class WorldView { public readonly scene: THREE.Scene; public get terrain(): THREE.Object3D | null; public showMap(map: GameMap): void; public dispose(): void }` — owns background, lights, terrain and water; `showMap` disposes the previous map's meshes.
  - `class TileHighlight { public readonly object: THREE.LineLoop; public showTile(map: GameMap, tx: number, ty: number): void; public hide(): void }`
  - `class TilePicker { public pick(ndc: NdcPoint, camera: THREE.Camera, terrain: THREE.Object3D, map: GameMap): TileCoord | null }`
  - `class FpsCounter { constructor(sampleCount: number); public addFrame(dtSeconds: number): void; public get fps(): number | null }` — mean over the last `sampleCount` frames; ignores `dt <= 0`; `null` before the first frame.
  - `class TileHover { constructor(pointer: Pointer, picker: TilePicker, highlight: TileHighlight, hud: Hud); public update(camera: THREE.Camera, terrain: THREE.Object3D | null, map: GameMap): TileCoord | null }` — returns the hovered tile.
  - `class Game { constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement); public start(): void; public loadMap(seed: number): void }` with private `update(dtSeconds)` and `render()`. In dev mode sets `window.__debug = { renderer: pixelRenderer.webgl, game: this }`.
  - `src/main.ts`: looks up `#game`, `#hud`, `#error`; constructs `Game` inside `try/catch` (on failure logs the error and shows `WebGL is not available in this browser.`); calls `start()`.

- [ ] **Step 1:** Discard the uncommitted local edit in `src/main.ts` (`git checkout -- src/main.ts`); its values are superseded by `GAME_CONFIG`.
- [ ] **Step 2: Write the failing test `tests/FpsCounter.test.ts`:** `fps` is `null` initially; after `addFrame(0.02)` ×3 it is ≈ `50`; with `sampleCount` 2, after frames `1, 0.1, 0.1` it is ≈ `10`; `addFrame(0)` and `addFrame(-1)` change nothing.
- [ ] **Step 3:** Run `npm test`; expected: fails, module not found.
- [ ] **Step 4:** Do the renames with `git mv`, convert each factory to its class per the interfaces above, split `main.ts` into `Game`, `WorldView`, `TileHover`, `Pointer`, `FpsCounter`, and update every import and test. Logic moves unchanged; only structure, names, modifiers and doc comments change.
- [ ] **Step 5:** Run `npm test` and `npm run build`; expected: all pass, same test count as before plus the FpsCounter tests.
- [ ] **Step 6: Browser check** (preview server `warriors-and-cavalry`, port 5180): island renders, WASD/QE/wheel work, highlight and HUD follow the cursor, "New map" works, no console errors.
- [ ] **Step 7:** Commit: `refactor: restructure into classes with one class per file`.

---

### Task 2: Heightfield ray picking

**Files:**
- Create: `src/render/heightfieldRaycast.ts`
- Modify: `src/render/TilePicker.ts`, `src/game/TileHover.ts`, `src/game/Game.ts`
- Test: `tests/heightfieldRaycast.test.ts`

**Interfaces:**
- Consumes: `GameMap` (`width`, `height`, `heightAt`, `inBounds`), `TerrainMeshBuilder`'s triangle split of a tile (read it; the two triangles tested per tile must be the same two the mesh draws).
- Produces:
  - `interface Vec3 { readonly x: number; readonly y: number; readonly z: number }`
  - `interface HeightfieldHit { readonly tx: number; readonly ty: number; readonly point: Vec3 }`
  - `raycastHeightfield(map: GameMap, origin: Vec3, direction: Vec3, maxDistance: number): HeightfieldHit | null` — no three.js import. Walks the tiles the ray's ground projection crosses in order (grid traversal) and returns the first triangle hit.
  - `TilePicker.pick(ndc: NdcPoint, camera: THREE.Camera, map: GameMap): TileCoord | null` (the `terrain` parameter is removed; `TileHover.update(camera, map)` likewise).

- [ ] **Step 1: Write failing tests** using a flat 8 × 8 map at height 0 and a generated 32 × 32 map:
  - Straight down from `(2.5, 10, 3.5)` on the flat map → tile `(2, 3)`, `point.y ≈ 0`.
  - Slanted ray from `(0.5, 5, 0.5)` with direction `(1, -1, 1)` → tile `(5, 5)`.
  - Ray starting outside the map at `(-5, 5, 4.5)` with direction `(1, -0.5, 0)` → tile `(5, 4)` (it reaches `y = 0` at `x = 5`).
  - Ray that lands outside the map → `null`.
  - Horizontal ray `(1, 0, 0)` at `y = 50`, upward ray `(0, 1, 0)`, zero direction `(0, 0, 0)` and a `NaN` direction → `null`, and each call returns (test must finish within the default timeout).
  - Agreement: for 300 seeded-random downward-slanted rays over the generated map, the result's tile equals the tile found by brute-force testing every triangle and taking the nearest hit.
- [ ] **Step 2:** Run `npm test`; expected: fails, module not found.
- [ ] **Step 3:** Implement `raycastHeightfield` (grid traversal in x/z, Möller–Trumbore or plane test per triangle, bounded by `maxDistance` and by the map rectangle).
- [ ] **Step 4:** Change `TilePicker.pick` to build the ray from the camera (`THREE.Raycaster.setFromCamera` gives origin and direction) and call `raycastHeightfield` with `maxDistance` 1000; update `TileHover` and `Game`.
- [ ] **Step 5:** Run `npm test` and `npm run build`; expected: pass.
- [ ] **Step 6: Browser check:** highlight still matches the cursor on slopes, shores and at the map edge; no console errors.
- [ ] **Step 7:** Commit: `feat: tile picking by heightfield ray traversal`.

---

### Task 3: 512 × 512 map with chunked terrain

**Files:**
- Modify: `src/render/TerrainMeshBuilder.ts`, `src/render/WorldView.ts`, `src/game/GameConfig.ts`, `src/sim/MapGenerator.ts`, `src/render/cameraMath.ts`
- Test: `tests/TerrainMeshBuilder.test.ts` (new), `tests/MapGenerator.test.ts`, `tests/cameraMath.test.ts`

**Interfaces:**
- Produces:
  - `TERRAIN_CHUNK_SIZE = 32`; `TerrainMeshBuilder.build(map: GameMap): THREE.Group` — one mesh per chunk, all sharing one material; edge chunks may be smaller.
  - `GAME_CONFIG.mapSize = 512`; `CAMERA_CONFIG.maxDistance = 160`.

- [ ] **Step 1: Write failing tests.**
  - `TerrainMeshBuilder`: a 64 × 64 map gives a group with 4 meshes, a 40 × 40 map gives 4 meshes (32+8 per axis), total vertex count over all chunks is `width * height * 6`, and all meshes share the same material instance.
  - `MapGenerator` at 512 × 512 for seeds `1..5`: land (non-`Water`) is 40–55 % of tiles; `Rock` is at most 15 % of tiles; every border tile is `Water`. Replace the stage 1 count assertions that no longer apply; keep determinism, non-square and seed-normalisation tests.
  - `cameraMath`: `zoomDistance(159, 100) === 160` (update the old 120 clamp case).
- [ ] **Step 2:** Run `npm test`; expected: the new assertions fail.
- [ ] **Step 3:** Implement chunking in `TerrainMeshBuilder`; update `WorldView` for the group; set `mapSize` to 512 and `maxDistance` to 160.
- [ ] **Step 4:** Tune `MAPGEN_CONFIG` (noise scale, octaves, height, shore drop, rock thresholds) until the generator tests pass. Record the final values, per-seed tile percentages and the measured generation time for 512 × 512 in the task report; generation must take under 500 ms.
- [ ] **Step 5:** Run `npm test` and `npm run build`; expected: pass.
- [ ] **Step 6: Browser check:** one large island with bays and hills is visible when zoomed out; panning across the whole map is smooth; picking still works; "New map" keeps `__debug.renderer.info.memory.geometries` constant; no console errors.
- [ ] **Step 7:** Commit: `feat: 512x512 map with chunked terrain`.

---

### Task 4: World, objects and placement rules

**Files:**
- Create: `src/sim/ObjectKind.ts`, `src/sim/MapObject.ts`, `src/sim/WorldCommand.ts`, `src/sim/World.ts`
- Test: `tests/World.test.ts`

**Interfaces:**
- Produces:
  - `ObjectKind = { Tree: 1, Keep: 2, Hovel: 3, WoodcutterHut: 4 } as const` with the derived type; `OBJECT_KINDS: Record<ObjectKind, ObjectKindInfo>` where `interface ObjectKindInfo { readonly name: string; readonly width: number; readonly height: number; readonly buildable: boolean }` — `Tree` 1×1 not buildable, `Keep` 4×4, `Hovel` 2×2, `Woodcutter's hut` 2×2, all three buildable.
  - `interface MapObject { readonly id: number; readonly kind: ObjectKind; readonly tx: number; readonly ty: number }`
  - `type PlacementFailure = 'NotBuildable' | 'OutOfBounds' | 'BadTerrain' | 'Occupied' | 'TooSteep'`; `type PlacementCheck = { readonly ok: true } | { readonly ok: false; readonly reason: PlacementFailure }`
  - `type WorldCommand = { readonly type: 'placeBuilding'; readonly kind: ObjectKind; readonly tx: number; readonly ty: number } | { readonly type: 'demolish'; readonly objectId: number }`
  - `type CommandResult = { readonly ok: true; readonly object: MapObject } | { readonly ok: false; readonly reason: PlacementFailure | 'UnknownObject' | 'NotDemolishable' }`
  - `interface WorldChange { readonly type: 'added' | 'removed'; readonly object: MapObject }`
  - `MAX_FOOTPRINT_SLOPE = 0.6`
  - `class World`:
    - `constructor(map: GameMap)`; `public readonly map: GameMap`
    - `public objectAt(tx: number, ty: number): MapObject | undefined` (undefined out of bounds)
    - `public objects(): Iterable<MapObject>`; `public get objectCount(): number`
    - `public canPlace(kind: ObjectKind, tx: number, ty: number): PlacementCheck` — checks in this order, first failure wins: `NotBuildable`, `OutOfBounds`, `BadTerrain` (any footprint tile not `Grass`/`Sand`), `Occupied`, `TooSteep` (max − min corner height over the whole footprint `> MAX_FOOTPRINT_SLOPE`).
    - `public apply(command: WorldCommand): CommandResult`
    - `public spawn(kind: ObjectKind, tx: number, ty: number): MapObject` — for the map generator only: adds an object without the buildable/terrain/slope rules; throws `RangeError` if out of bounds or occupied; notifies listeners.
    - `public onChange(listener: (change: WorldChange) => void): () => void` — returns an unsubscribe function.
  - Ids start at 1 and increase by 1; an id is never reused.

- [ ] **Step 1: Write failing tests** on hand-built small maps (flat grass unless stated):
  - `canPlace` returns `ok` for a Hovel on flat grass and on sand.
  - Each failure: `Tree` → `NotBuildable`; Keep at `(width-3, 0)` → `OutOfBounds`; negative and non-integer coordinates → `OutOfBounds`; one footprint tile `Water` or `Rock` → `BadTerrain`; overlapping an existing object by one tile → `Occupied`; one raised corner making the height range `0.7` → `TooSteep`, range `0.6` → ok.
  - Order: a footprint that is both on rock and occupied reports `BadTerrain`.
  - `apply(placeBuilding)` success returns the object with id 1, `objectAt` returns it for all 4 footprint tiles of a Hovel and `undefined` next to it, `objectCount` is 1, one `added` change is delivered.
  - `apply(placeBuilding)` failure returns the reason, changes nothing, notifies nobody.
  - `apply(demolish)` of a building frees all its tiles, delivers one `removed` change, and the same spot can be built on again with a new id (2).
  - `apply(demolish)`: unknown id → `UnknownObject`; a spawned tree → `NotDemolishable`; demolishing the same building twice → second is `UnknownObject`.
  - `spawn` of a tree on an occupied tile throws `RangeError`.
  - The unsubscribe function returned by `onChange` stops notifications.
- [ ] **Step 2:** Run `npm test`; expected: fails, modules not found.
- [ ] **Step 3:** Implement the four files. Occupancy is an `Int32Array` of object ids (0 = free), one entry per tile.
- [ ] **Step 4:** Run `npm test` (including `simPurity`) and `npm run build`; expected: pass.
- [ ] **Step 5:** Commit: `feat: World with objects, occupancy and placement commands`.

---

### Task 5: Generated trees; generator returns a World

**Files:**
- Create: `src/sim/TreePlacer.ts`
- Modify: `src/sim/MapGenerator.ts`, `src/game/Game.ts`, `src/render/WorldView.ts` (signature only), tests that call `generate`
- Test: `tests/TreePlacer.test.ts`, `tests/MapGenerator.test.ts`

**Interfaces:**
- Consumes: `World.spawn`, `ObjectKind.Tree`, `fbm2`, `hash2`.
- Produces:
  - `TREE_CONFIG` (frozen): `noiseScale`, `octaves`, `densityThreshold`, `seedOffset` — tuned in Step 4.
  - `class TreePlacer { public place(world: World, seed: number): void }` — a `Grass` tile gets a tree when forest density (`fbm2` with `seed + seedOffset`) combined with `hash2` of the tile exceeds the threshold; tiles are visited in row-major order so ids are deterministic.
  - `MapGenerator.generate(params: MapParams): World` (terrain, then trees).
  - `worldChecksum(world: World): number` replaces `mapChecksum`: FNV-1a over heights, tiles, then each object's `id, kind, tx, ty` in id order.
  - `WorldView.showWorld(world: World): void` replaces `showMap` (still draws only terrain and water in this task).

- [ ] **Step 1: Write failing tests.**
  - Same seed → identical object lists and equal `worldChecksum`; seeds 1 and 2 differ.
  - For seeds `1..5` at 512 × 512: every tree stands on `Grass`; trees cover 8–20 % of `Grass` tiles; no two objects share a tile; object ids are `1..objectCount` without gaps.
  - Clustering: the share of trees that have at least one tree among their 4 neighbours is above 60 %.
  - `worldChecksum` changes after a successful `placeBuilding` command.
- [ ] **Step 2:** Run `npm test`; expected: fails.
- [ ] **Step 3:** Implement `TreePlacer`, change `MapGenerator.generate` and the checksum, update `Game`/`WorldView` and existing tests to the `World` return type.
- [ ] **Step 4:** Tune `TREE_CONFIG` until the density and clustering tests pass; record values and per-seed tree counts in the task report. Total generation time for 512 × 512 stays under 500 ms.
- [ ] **Step 5:** Run `npm test` and `npm run build`; expected: pass.
- [ ] **Step 6:** Commit: `feat: deterministic forests; generator returns a World`.

---

### Task 6: Rendering trees and buildings

**Files:**
- Create: `src/render/TreeLayer.ts`, `src/render/BuildingMeshFactory.ts`, `src/render/BuildingLayer.ts`
- Modify: `src/render/WorldView.ts`, `src/game/Game.ts`
- Test: `tests/BuildingLayer.test.ts`, `tests/TreeLayer.test.ts`

**Interfaces:**
- Consumes: `World` (`objects()`, `onChange`, `map`), `OBJECT_KINDS`, `disposeObject`.
- Produces:
  - `class TreeLayer { constructor(world: World); public readonly object: THREE.Group; public dispose(): void }` — two `InstancedMesh`es (trunk: brown `0x6b4a2b` cylinder; foliage: dark green `0x2f6b2f` cone), one instance per tree, placed at the tile centre and tile height; height about 1.6 world units, scale varied ±20 % and rotation varied by `hash2(world.map.seed, tx, ty)`.
  - `class BuildingMeshFactory { public create(kind: ObjectKind): THREE.Group }` — local origin at the footprint's lowest-coordinate corner, `y = 0` at floor level, covering the footprint with a 0.15 margin; includes a foundation block reaching 1 unit below the floor. Colours: Keep stone `0x9a9a94` with a taller corner tower; Hovel walls `0x8a6a45`, roof `0xc9b458`; Woodcutter's hut walls `0x7a5a3a`, roof `0x4a3a2a`. Throws for `ObjectKind.Tree`.
  - `class BuildingLayer { constructor(world: World, factory: BuildingMeshFactory); public readonly object: THREE.Group; public get buildingCount(): number; public dispose(): void }` — creates meshes for existing buildings, subscribes to `world.onChange`, removes and disposes the mesh on `removed`; a building's floor sits at the highest corner height of its footprint; `dispose()` unsubscribes and disposes everything.
  - `WorldView.showWorld(world)` now also creates the two layers and disposes the previous ones.
  - Dev mode: `window.__debug.world` is the current `World`.

- [ ] **Step 1: Write failing tests** (three.js geometry works in Node without WebGL):
  - `TreeLayer` on a small world with 3 spawned trees: both instanced meshes have `count === 3`; a world with no trees gives `count === 0` and no exception.
  - `BuildingLayer`: starts with `buildingCount` 0 on a world with only trees; after `apply(placeBuilding Hovel)` it is 1 and `object.children.length` is 1; after `demolish` both are 0; after `dispose()` a further `placeBuilding` does not change `buildingCount`.
  - `BuildingMeshFactory.create` returns a non-empty group for each buildable kind and throws for `Tree`; the Keep's bounding box is wider than the Hovel's.
- [ ] **Step 2:** Run `npm test`; expected: fails, modules not found.
- [ ] **Step 3:** Implement the three classes and wire them into `WorldView.showWorld` and `Game`.
- [ ] **Step 4:** Run `npm test` and `npm run build`; expected: pass.
- [ ] **Step 5: Browser check:** forests are visible on the island and read as trees at the default zoom; from the console, `__debug.world.apply({ type: 'placeBuilding', kind: 3, tx, ty })` on a flat grass tile shows a Hovel, kind `2` a Keep, kind `4` a Woodcutter's hut, and `{ type: 'demolish', objectId }` removes it; "New map" removes all buildings and keeps `renderer.info.memory.geometries` constant; frame rate while panning stays about 60; no console errors.
- [ ] **Step 6:** Commit: `feat: render trees and buildings`.

---

### Task 7: Build bar, placement ghost and input

**Files:**
- Create: `src/game/BuildController.ts`, `src/game/BuildTool.ts`, `src/ui/BuildBar.ts`, `src/render/PlacementGhost.ts`
- Modify: `src/game/Game.ts`, `src/game/TileHover.ts`, `src/render/TileHighlight.ts`, `src/ui/Hud.ts`, `src/input/Pointer.ts`, `index.html`
- Test: `tests/BuildController.test.ts`

**Interfaces:**
- Consumes: `World.canPlace`, `World.apply`, `World.objectAt`, `OBJECT_KINDS`, `BuildingMeshFactory`.
- Produces:
  - `type BuildTool = { readonly type: 'build'; readonly kind: ObjectKind } | { readonly type: 'demolish' } | null`; `BUILD_TOOLS: readonly BuildToolEntry[]` in bar order — `Keep` (key `Digit1`), `Hovel` (`Digit2`), `Woodcutter` (`Digit3`), `Demolish` (`Digit4`).
  - `class BuildController` (no DOM, no three.js):
    - `constructor(world: World, onMessage: (text: string) => void)`
    - `public get tool(): BuildTool`; `public selectTool(tool: BuildTool): void`; `public cancel(): void` (sets tool to `null`)
    - `public setWorld(world: World): void` — call on "New map"; keeps the active tool.
    - `public preview(tile: TileCoord | null): PlacementPreview | null` — for a build tool and a tile: `{ kind, tx, ty, ok }` from `canPlace`; otherwise `null`.
    - `public click(tile: TileCoord | null): CommandResult | null` — `null` when there is no tool or no tile; build tool → `placeBuilding`; demolish tool → `demolish` of `objectAt(tile)`, or failure `UnknownObject` on an empty tile. On failure calls `onMessage` with `Cannot build: <reason>` / `Cannot demolish: <reason>`, reasons worded: `out of bounds`, `bad terrain`, `occupied`, `too steep`, `nothing here`, `trees cannot be removed`.
  - `class BuildBar { constructor(root: HTMLElement, onSelect: (tool: BuildTool) => void); public setActive(tool: BuildTool): void }` — one button per `BUILD_TOOLS` entry labelled `1 Keep` etc.; clicking the active button deselects; the active button has class `active`; buttons blur after click.
  - `class PlacementGhost { constructor(factory: BuildingMeshFactory); public readonly object: THREE.Group; public show(world: World, preview: PlacementPreview): void; public hide(): void }` — translucent (opacity 0.5) building, tinted green `0x44ff66` when `ok`, red `0xff4444` otherwise; floor at the footprint's highest corner height (clamped to in-bounds tiles).
  - `TileHighlight.showFootprint(map: GameMap, tx: number, ty: number, width: number, height: number): void` — outline around the footprint rectangle following corner heights, skipping corners outside the map.
  - `Hud`: `HudTileInfo` gains `readonly objectName?: string` (line becomes `Tile: 12, 40 Grass h=2.3 — Hovel`); `public showMessage(text: string, seconds: number): void` shows a fourth line that clears itself.
  - `Pointer`: `public onClick(listener: (button: number) => void): void` — fires for pointer-down-then-up on the canvas without leaving it.
  - `index.html`: `<div id="buildbar">` bottom centre, styled like the HUD.
  - `Game` wiring: keys `Digit1`–`Digit4` select tools (ignore `event.repeat`), `Escape` and right-click cancel, left-click calls `BuildController.click(hoveredTile)`; each frame the ghost and footprint highlight follow `preview(hoveredTile)`; with no tool, the highlight outlines the hovered object's footprint or the single tile; "New map" calls `setWorld`.

- [ ] **Step 1: Write failing tests in `tests/BuildController.test.ts`** on a small flat-grass `World`:
  - No tool: `click({ tx: 1, ty: 1 })` and `preview(...)` return `null`; world unchanged.
  - Hovel tool: `preview` is `ok: true` on free grass and `ok: false` over a spawned tree; `click` places a Hovel and the tool is still the Hovel tool.
  - `click(null)` with a tool returns `null`, places nothing, sends no message.
  - Rejected placement (occupied) returns the failure and sends exactly `Cannot build: occupied`.
  - Keep tool at the map edge: `preview` is `ok: false`, `click` sends `Cannot build: out of bounds`, no exception.
  - Demolish tool: on a building removes it; on a tree sends `Cannot demolish: trees cannot be removed`; on an empty tile sends `Cannot demolish: nothing here`.
  - `cancel()` sets the tool to `null`.
  - `setWorld(newWorld)` keeps the tool; the next `click` places into `newWorld` and the old world's `objectCount` is unchanged.
- [ ] **Step 2:** Run `npm test`; expected: fails, modules not found.
- [ ] **Step 3:** Implement `BuildTool.ts` and `BuildController.ts`; run `npm test`; expected: pass.
- [ ] **Step 4:** Implement `BuildBar`, `PlacementGhost`, the `TileHighlight`, `Hud` and `Pointer` additions, the `index.html` bar, and the `Game` wiring.
- [ ] **Step 5:** Run `npm test` and `npm run build`; expected: pass.
- [ ] **Step 6: Browser check:**
  - Keys 1–4 and the bar buttons select tools; the active button is marked; Esc and right-click deselect.
  - The ghost is green on flat free grass and red on water, rock, trees, steep ground and at the map edge.
  - Left-click places each building type; several can be placed in a row; a rejected click shows the reason in the HUD for about two seconds.
  - Demolish removes a building; on a tree it shows the message.
  - Clicking the HUD or the build bar never places a building.
  - Hovering a building with no tool outlines its footprint and names it in the HUD.
  - "New map" with a tool active: old buildings are gone, the tool still works on the new map.
  - WASD/QE/wheel still work with a tool active; no console errors.
- [ ] **Step 7:** Commit: `feat: build bar, placement ghost and building placement`.
