# Stage 2 — Class Refactor, Larger Map, Trees and Buildings

Date: 2026-11-12
Status: draft, waiting for review
Builds on: `2026-11-11-stage1-map-design.md` (all of its rules still apply
unless this document changes them).

## Goal

1. The code is restructured into classes with explicit members and clear
   public methods, so it reads naturally to a C# developer.
2. The map grows from 128 × 128 to 512 × 512 tiles and still runs at 60 FPS.
3. The world contains objects: trees placed by the map generator, and
   buildings the player places from a build bar.

## Out of scope

Resources and building costs, units, tree cutting, walls, building rotation,
terrain flattening, minimap, saving, sound, networking.

## Part A — Class refactor (behaviour unchanged)

Style rules for all code from now on:

- One class per file; the file is named after the class (`Game.ts`).
- Every member has an explicit `public`, `private` or `readonly` modifier;
  every method has an explicit return type.
- Data passed between classes is described by a named `interface`.
- Every public method has a doc comment: what it does and when to call it.
- Stateless math (noise, PRNG, camera math, render-size math) stays as plain
  exported functions in camelCase files.
- No factory functions returning object literals (`createHud()` becomes
  `new Hud(...)`).

Target structure after Part A:

```
src/
  main.ts                 finds DOM elements, creates Game, calls start()
  game/
    Game.ts               owns all objects and the frame loop
    GameConfig.ts         map size, pixel scale, FPS sampling (one frozen object)
    FpsCounter.ts         addFrame(dt), fps
    TileHover.ts          Pointer + TilePicker -> TileHighlight + Hud
    seed.ts               parseSeed, randomSeed (moved from src/)
  sim/                    deterministic; no three.js, no DOM (unchanged rule)
    GameMap.ts            (renamed from map.ts)
    MapGenerator.ts       generate(params): GameMap; config stays frozen
    tiles.ts, rng.ts, noise.ts
  render/
    WorldView.ts          scene, lights, terrain, water; showMap(map), dispose()
    PixelRenderer.ts      class; resize(), render(scene, camera)
    CameraRig.ts          (already a class)
    TerrainMeshBuilder.ts build(map): Mesh
    WaterMeshBuilder.ts   build(map, seaLevel): Mesh
    TileHighlight.ts      show(...), hide()
    TilePicker.ts         pick(ndcX, ndcY, camera): TileCoord | null
    cameraMath.ts, renderSize.ts
  input/
    Keyboard.ts           isDown(code), dispose()
    Pointer.ts            cursor position in normalised device coordinates
  ui/
    Hud.ts                seed, tile, FPS lines; New map button
```

`Game` public surface: `constructor(canvas, hudRoot)`, `start(): void`,
`loadMap(seed: number): void`. Its frame is split into private `update(dt)`
and `render()`.

The developer's local values `MAP_SIZE = 256` and `FPS_SAMPLES = 60` are
superseded by `GameConfig` (map size 512 from Part B, FPS samples 60).

All existing tests are kept and updated to the new names. No behaviour
changes in Part A.

## Part B — 512 × 512 map

- `GameConfig.mapSize = 512`.
- **Chunked terrain:** the terrain is built as 32 × 32-tile chunks (256
  meshes) so three.js can skip chunks outside the view. Water stays one plane.
- **Picking without the mesh:** `TilePicker` no longer raycasts the terrain
  mesh. A pure function with no three.js dependency
  (`render/heightfieldRaycast.ts`) walks the ray across the tile grid and
  tests the two triangles of each tile it crosses, using `GameMap` heights.
  Cost is proportional to the tiles under the ray, not to the map size.
- **Generator tuning:** noise scale and octaves are re-tuned so a 512 map is
  one large island with bays and hills rather than a blown-up version of the
  small one. Targets for seeds 1–5: land 40–55 % of tiles, rock no more than
  15 % of tiles, every border tile `Water`.
- **Camera:** maximum zoom distance raised from 120 to 160.
- Map generation for 512 × 512 completes in under 500 ms on this machine.

## Part C — World objects (simulation)

New files in `src/sim/`:

- `ObjectKind.ts` — `Tree`, `Keep`, `Hovel`, `WoodcutterHut` with per-kind
  data: display name, footprint (tiles), whether the player can build it.

  | Kind | Footprint | Player-buildable |
  |---|---|---|
  | Tree | 1 × 1 | no |
  | Keep | 4 × 4 | yes |
  | Hovel | 2 × 2 | yes |
  | Woodcutter's hut | 2 × 2 | yes |

- `MapObject.ts` — `interface MapObject { id, kind, tx, ty }`; `tx, ty` is
  the footprint's lowest-coordinate corner.
- `World.ts` — owns the `GameMap`, the objects and an occupancy grid (one
  object id per tile, 0 = free).
  - `objectAt(tx, ty): MapObject | undefined`
  - `objects(): Iterable<MapObject>`
  - `canPlace(kind, tx, ty): PlacementCheck` — `{ ok: true }` or
    `{ ok: false, reason }` where reason is one of `OutOfBounds`,
    `BadTerrain`, `Occupied`, `TooSteep`, `NotBuildable`.
  - `apply(command: WorldCommand): CommandResult` — the **only** way to
    change the world after generation.
  - `onChange(listener)` — notifies `{ type: 'added' | 'removed', object }`.
- `WorldCommand.ts` — `{ type: 'placeBuilding', kind, tx, ty }` and
  `{ type: 'demolish', objectId }`. Commands are plain serialisable data.
- `TreePlacer.ts` — called by `MapGenerator`; deterministic from the seed.

Placement rules for buildings (all footprint tiles must pass):

1. inside the map;
2. terrain is `Grass` or `Sand`;
3. no object on the tile (trees block building);
4. the difference between the highest and lowest corner height over the whole
   footprint is at most 0.6 world units.

Demolish removes buildings only; trees cannot be demolished in this stage.

Trees: on `Grass` tiles only, where a second low-frequency noise field
(forest density) combined with a per-tile hash exceeds a threshold, giving
clustered forests with clearings. Target: trees on 8–20 % of `Grass` tiles.

`generateMap` now returns a `World` (map plus trees). `mapChecksum` becomes
`worldChecksum` and covers objects as well.

Multiplayer readiness: because every change is a serialisable command applied
through `World.apply`, a later stage can send commands over the network and
apply them in the same order on every client. UI and render code never
mutate the world directly.

## Part D — Rendering objects

- `render/TreeLayer.ts` — all trees as two instanced meshes (trunk, foliage
  cone). Each tree gets a deterministic small variation in scale and rotation
  from a hash of its tile. Trees stand at their tile's height.
- `render/BuildingMeshFactory.ts` — builds a low-poly mesh per building kind
  from boxes and a roof shape, sized to the footprint, each kind with its own
  colours (Keep: stone grey with a taller tower; Hovel: timber walls, straw
  roof; Woodcutter's hut: timber walls, dark roof). A foundation block fills
  the gap between the building and uneven ground.
- `render/BuildingLayer.ts` — listens to `World.onChange`; adds and removes
  building meshes; disposes them on removal and on "New map".
- `render/PlacementGhost.ts` — translucent copy of the selected building
  following the hovered tile: green when `canPlace` is ok, red otherwise.
- `TileHighlight` outlines the whole footprint of the selected building, or
  of the object under the cursor, or a single tile.
- No shadows in this stage.

## Part E — Build bar and input

- `ui/BuildBar.ts` — HTML bar at the bottom centre with buttons: `Keep`,
  `Hovel`, `Woodcutter`, `Demolish`. The active tool is visibly marked.
- `game/BuildController.ts` — holds the active tool and turns clicks into
  commands.
  - Keys `1`–`4` select the tools; `Esc` or right-click returns to no tool.
  - Left-click with a building tool: `placeBuilding` at the hovered tile; the
    hovered tile is the footprint's lowest-coordinate corner. The tool stays
    active so several buildings can be placed.
  - Left-click with Demolish on a building: `demolish`.
  - A rejected command changes nothing; the HUD shows the reason for two
    seconds (`Cannot build: occupied`).
- HUD tile line also names the object on the tile:
  `Tile: 12, 40 Grass h=2.3 — Hovel`.
- Clicks on the HUD or build bar never reach the map.

## Testing

Unit tests (Vitest):

- `World`: each placement rule accepts and rejects correctly; footprints
  overlapping the map edge; occupancy is set on place and cleared on
  demolish; demolishing a tree or an unknown id is rejected; listeners fire
  once per change; `apply` is the only mutating path.
- Trees: same seed → identical trees; all on `Grass`; density within target
  for seeds 1–5; no two objects share a tile.
- `worldChecksum`: equal for equal seeds, changes after a command.
- Heightfield raycast: hits the expected tile from several angles; misses
  outside the map; agrees with brute-force triangle tests on random rays.
- Purity test still covers every file in `src/sim`.
- Existing tests keep passing under their new names.

Browser check: 512 map with forests visible; 60 FPS while panning; place each
building; red ghost on water, rock, trees and steep ground; demolish; "New
map" clears buildings and GPU memory stays flat; no console errors.

## Done when

1. `npm test` and `npm run build` pass.
2. The browser check passes.
3. 60 FPS at 512 × 512 with trees on this machine.
4. Code is merged to `main` and pushed.
