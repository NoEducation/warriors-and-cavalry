# Beach blend and building detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The beach fades into the grass along a soft, curving edge, and every building gets a richer outline and surface detail.

**Architecture:** Sand and Grass corners share one height-plus-noise blend in the render-side terrain colours, so a border corner is the same colour from both tiles. Buildings keep their one-merged-mesh contract (`ShapeBuilder`), with a new kit of detail and roof helpers and shade-varied stone courses.

**Tech Stack:** TypeScript (strict), three.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-beach-blend-and-building-detail-design.md`

## Global Constraints

- Render only: nothing under `src/sim/` changes.
- Each building is one mesh: one merged geometry with vertex colours and one flat-shaded `MeshLambertMaterial`.
- Each model stays inside its footprint, and its foundation reaches at least 1.5 below the floor.
- Triangle budget: a Wall is 150 or under, a Gate 400 or under, any other building 1500 or under.
- No detail is thinner than about 0.05 world units, and main features are about 0.1 or more.
- The front of a building is the high-z side.
- `StockpileShape.deckTop`, `deckInset`, `WheatFarmShape.soilTop` and `fieldInset` keep their values. The deck and the field stay clear.
- Gate passage open at mid-height. Wall and Gate fill exactly `0..1` in x and z.
- AGENTS.md style: one class per file, explicit modifiers and return types, doc comments on public members, files under about 150 lines, config objects for tunables, no `enum`.

## Review Focus

1. **Sand corners high on a dune, or grass corners dipping low inland.** The colour should still come out as a believable sand-to-grass mix, never a hard step. Task 1 tests a shared corner at any height.
2. **A beach meeting Rock or quarry ground.** That edge should stay as it is today. Task 1 tests that Rock stays grey at beach height.
3. **Details poking past the footprint on 1 x 1 castle pieces.** Slits, coping and portcullis must stay within `0..1`. The existing footprint test covers this, with an epsilon.
4. **Gate door leaves or the portcullis closing the passage.** Walkers' gap must stay visibly open. The existing mid-height ray tests cover this, and Task 6 adds a ray at 0.8 height.
5. **The same building looking different between builds (unseeded shade).** Task 2 tests that the course shades are stable.

---

### Task 1: Beach fades into grass

**Files:**
- Modify: `src/render/shoreColor.ts` (config plus `beachGrassBlend`)
- Modify: `src/render/terrainColor.ts` (Grass and Sand cases share the mix; pull the grass colour into a private function)
- Test: `tests/shoreColor.test.ts`, `tests/terrainColor.test.ts`

**Interfaces:**
- Produces: `beachGrassBlend(map: GameMap, cx: number, cy: number): number` returns a value in `[0, 1]`: 0 is beach, 1 is grass.
- New `SHORE_LOOK_CONFIG` keys:
  - `grassBlendHalfWidth: 0.2`, the half-height of the band around `seaLevel + sandBand`.
  - `edgeJitter: 0.14` and `edgeScale: 1 / 7`, the coarse wobble.
  - `tuftJitter: 0.07` and `tuftScale: 1 / 1.3`, the fine fray.
  - New salts `edge` and `tuft` in `SALT`.

- [ ] **Step 1: Write failing tests.**
  - `shoreColor.test.ts` → `describe('beachGrassBlend')`:
    - At height `0.05` it is `0`. At height `1.2` it is `1`.
    - Across a 40 x 40 map at height `0.5`, some corners are strictly between 0 and 1, and the values are not all equal (the noise wobbles).
    - Two calls with the same arguments give the same value.
  - `terrainColor.test.ts` → `'gives Sand and Grass one colour at the same corner'`:
    - On `mapOf(20, (x) => 0.2 + 0.05 * x)`, for every `cx` in `0..20`, `colorAt(map, Sand, cx, 10)` equals `colorAt(map, Grass, cx, 10)`.
    - Also on a map where `cx = 0` is grass height (2) and `cx = 20` is beach height (0.05): Grass at `cx = 0` matches the pure grass formula (greener: `g > r`), and Sand at `cx = 20` is sandy (`r > g * 0.9`).
  - `terrainColor.test.ts` → `'keeps Rock out of the beach blend'`: on a flat map at height `0.5`, Rock is grey, not sandy (`Math.abs(r - b) < 0.12`), and it differs from the Sand colour at the same corner.
- [ ] **Step 2:** Run `npx vitest run tests/shoreColor.test.ts tests/terrainColor.test.ts`. Expected: FAIL (`beachGrassBlend` not exported, and Sand and Grass colours differ).
- [ ] **Step 3: Implement.**
  - `beachGrassBlend = smooth(mid - half, mid + half, h + edgeJitter*2*(n(edge)-0.5) + tuftJitter*2*(n(tuft)-0.5))`, where `mid = seaLevel + sandBand`.
  - In `terrainVertexColor`, both `TileType.Grass` and `TileType.Sand` set `out` to the grass colour, compute the sand colour into a module scratch `Color`, and `out.lerp(sand, 1 - blend)`. Skip whichever side has a weight of 0, so inland grass stays as cheap as today.
- [ ] **Step 4:** Run the same command. Expected: PASS. Then run `npx vitest run tests/terrainCornerColor.test.ts tests/TerrainMeshBuilder.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit: `render: beaches fade into grass along a soft, noisy edge shared by both tile types`.

### Task 2: Building detail kit

**Files:**
- Create: `src/render/buildings/roofParts.ts`. Move `gableRoofGeometry` here from `shapeParts.ts` and update the Granary and Woodcutter imports.
- Create: `src/render/buildings/detailParts.ts`
- Create: `src/render/buildings/shadeVariant.ts`
- Modify: `src/render/buildings/ShapeBuilder.ts` (`addCourses`)
- Modify: `src/render/buildings/shapeParts.ts` (new colours)
- Test:
  - `tests/roofParts.test.ts`, `tests/detailParts.test.ts`, `tests/shadeVariant.test.ts`
  - `tests/BuildingMeshFactory.test.ts` (budget)

**Interfaces (produced, used by Tasks 3 to 7):**
- `SHAPE_COLORS` adds:
  - `door: 0x4f3622`, `shutter: 0x5d7a4a`, `windowDark: 0x2a241e`
  - `ridge: 0x8f7a3a`, `banner: 0xa3302a`, `rope: 0xb59a6a`, `plaster: 0xd9cfb4`
- `shadeVariant(color: number, salt: number, index: number, swing?: number): number` returns `color` scaled in brightness by `1 + swing * (2 * hash2(salt, index, 0) - 1)`, with `swing` defaulting to `BUILDING_DETAIL_CONFIG.shadeSwing = 0.07`. `BUILDING_DETAIL_CONFIG` lives in `shadeVariant.ts`.
- `ShapeBuilder.addCourses(spec: BoxSpec, color: number, courses: number, salt: number): this` splits `spec` into `courses` equal horizontal bands, band `i` painted `shadeVariant(color, salt, i)`.
- `type WallFace = 'south' | 'north' | 'east' | 'west'`. South is +z, the front.
- `interface FaceSpot { readonly wall: BoxSpec; readonly face: WallFace; readonly along: number; readonly bottom: number; readonly width: number; readonly height: number }`. `along` is the detail's centre in world x (south and north faces) or world z (east and west faces).
- `detailParts.ts` exports, each adding painted boxes to `shape`:
  - `addDoor(shape: ShapeBuilder, at: FaceSpot): void`: a dark leaf, a timber frame and a lintel standing proud of the face by `DETAIL_DEPTH = 0.05`.
  - `addWindow(shape: ShapeBuilder, at: FaceSpot): void`: a dark pane with a shutter on each side.
  - `addArrowSlit(shape: ShapeBuilder, at: FaceSpot): void`: a dark slit proud by `0.02` (thin, so it fits 1 x 1 pieces).
  - `addTimberFrame(shape: ShapeBuilder, wall: BoxSpec, beam: number): void`: corner posts, plus a sill and head beam on the south and east faces.
  - `addPlinth(shape: ShapeBuilder, wall: BoxSpec, height: number, overhang: number): void`: a stone course around the wall's foot.
  - `addChimney(shape: ShapeBuilder, x: number, z: number, size: number, y0: number, y1: number): void`
- `roofParts.ts` exports:
  - `gableRoofGeometry` (unchanged signature)
  - `leanToRoofGeometry(spec: BoxSpec, rise: number, overhang: number): THREE.BufferGeometry` (high edge at low z)
  - `pyramidRoofGeometry(spec: BoxSpec, rise: number, overhang: number): THREE.BufferGeometry`
  - `addThatchRoof(shape: ShapeBuilder, spec: BoxSpec, rise: number, overhang: number, color: number): void`: two stacked gable layers, the upper one smaller and a shade darker, plus a ridge cap in `SHAPE_COLORS.ridge`.

- [ ] **Step 1: Write failing tests.**
  - `shadeVariant`: it is stable across calls. Over 50 indices it gives at least 3 distinct values. Every channel stays within ±8% of the base.
  - `detailParts`: for each helper on a `{0.4..1.6, 0..0.9, 0.4..1.6}` wall with each face, the built mesh's bounding box lies within the wall grown by `0.06` on every side. The detail on the `'south'` face has `max.z > wall.z1`.
  - `roofParts`: each geometry's bounding box spans the wall plus its overhang in x and z, and rises by `rise` above `y1`.
  - `BuildingMeshFactory.test.ts`: replace `toBeLessThan(150)` with a per-kind `TRIANGLE_BUDGET` (Wall 150, Gate 400, others 1500).
- [ ] **Step 2:** Run `npx vitest run tests/shadeVariant.test.ts tests/detailParts.test.ts tests/roofParts.test.ts tests/BuildingMeshFactory.test.ts`. Expected: the new files fail, and the factory test passes.
- [ ] **Step 3:** Implement the interfaces above.
- [ ] **Step 4:** Run the same command, plus `npx vitest run tests/layers.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit: `render: building detail kit (doors, windows, slits, framing, plinths, roofs, shaded stone courses)`.

### Tasks 3–7: Buildings

Each task rebuilds the named shapes per the spec's "Per building" list, using the Task 2 kit.

Shared steps:
1. Add to `BuildingMeshFactory.test.ts` the task's floor test: `'gives the <Kind> at least N triangles of detail'`. The floors are below.
2. Run the test and watch it fail.
3. Rebuild the shape.
4. Run `npx vitest run tests/BuildingMeshFactory.test.ts` (plus the listed extra tests) and watch it pass.
5. Look at the building in the dev server.
6. Commit.

Split a shape into helper files when it passes about 150 lines.

| Task | Shapes | Floor (triangles) | Extra tests | Commit |
| --- | --- | --- | --- | --- |
| 3 | Hovel, Woodcutter's hut | 300 each | — | `render: hovel and woodcutter's hut get framing, doors, windows, chimneys and layered roofs` |
| 4 | Granary, Stockpile | 300, 150 | `StockpileStacks.test.ts` (the deck top is unchanged), and a new assertion that a downward ray at the Stockpile's centre first hits at `y ≈ deckTop` | `render: granary on braced stilts with ramp and sacks; stockpile deck of planks with rails` |
| 5 | Keep | 600 | — | `render: keep with plinth, buttresses, forebuilding, slits, battlements and banner` |
| 6 | Wall, Gate, Tower | Wall 90, Gate 200, Tower 400 | A Gate ray at height `0.8` along the passage misses, for both passages | `render: castle pieces get plinths, courses, coping, portcullis, slits and corbels` |
| 7 | Quarry, Wheat farm | 300, 200 | `FarmCrops.test.ts` (the soil top is unchanged), and a downward ray at the farm's centre first hits at `y ≈ soilTop` | `render: quarry with uneven face, scaffold, hoist and cart; farm with full fence, gate gap and scarecrow` |

### Task 8: Gate and visual proof

- [ ] Run `npm test` and `npm run build` on HEAD. Expected: both pass.
- [ ] Start the dev server (`preview_start`), place one of each building next to a beach, and take screenshots of the beach edge and the buildings.
- [ ] If any detail does not read at the default camera distance, drop it or make it bigger, re-run the gate, and commit.
