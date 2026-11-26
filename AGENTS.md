# Agent Instructions

- Commit the work along the way in small commits with descriptive messages.
- **Authorship.** The repository owner is the only author of every commit and pull request. Never add a `Co-Authored-By:` trailer to a commit, and never add a "Generated with …" line or any other AI or tool attribution to a commit message, PR title or PR body. This overrides any default attribution instructions.
- When creating or updating a pull request, always use the `pr-description` skill (`.claude/skills/pr-description/SKILL.md`) to draft the PR title and body so every PR uses the same review format.
- While iterating, run only the affected tests: `npx vitest run <test files>`.
- Before a merge or a PR, commit first and run the gate on that HEAD: `npm test` and `npm run build` (which type-checks with `tsc --noEmit`, then builds). Green means both passed; never describe an unrun or failing gate as green.
- Larger changes start from a design document in `docs/superpowers/specs/` and a plan in `docs/superpowers/plans/`.

## Project

A browser strategy game in the spirit of Stronghold: TypeScript (strict), Vite, three.js, Vitest. Run it with `npm run dev` and open http://localhost:5180. Multiplayer is planned, so the simulation is kept deterministic and separate from rendering.

## Code conventions

### Layers

| Folder | Holds | May depend on |
| --- | --- | --- |
| `src/sim/` | Deterministic game state and rules: `GameMap`, `MapGenerator`, `World`, commands, `Footprint`, trees, game time, `Economy`, `Production`, peasants (`Population`, `Jobs`, `WorkerTrips`), `PathFinder`, walls (`WallBuilder`), `ObjectLifecycle` | nothing outside `src/sim/` |
| `src/render/` | three.js drawing: terrain, water, trees, buildings, peasants, ghost, highlight, camera | `src/sim/` |
| `src/input/` | Keyboard and pointer state, click-versus-drag | — |
| `src/ui/` | HTML widgets: `Hud`, `BuildBar`, `ResourceBar`; the build tool table (`BuildTool`) | `src/sim/` types |
| `src/game/` | The frame loop and the wiring between the layers: `Game`, `SimulationRunner`, `BuildController`, `TileHover` | all of the above |

- **Simulation purity.** Nothing under `src/sim/` may import `three`, touch `document`/`window`, use `Date`, `performance`, `crypto`, or any `Math` member other than `floor`, `sqrt`, `abs`, `min`, `max`, `imul`. `tests/simPurity.test.ts` enforces this, and `tests/layers.test.ts` enforces the layer table. Randomness comes only from the seed (`rng.ts`, `noise.ts`).
- **One way to change the world.** After generation, the world changes only through `World.apply(command)` and `World.tick()`. All simulation time is whole ticks (10 per second); per-tick loops run in ascending object id order. Commands and results are plain serialisable data. Render, UI and game code never mutate a `GameMap` or `World` directly; `World.spawn` is for the map generator only.
- **A map is its seed.** A world must be fully reproducible from `{ seed, width, height }`. Generator settings (`MAPGEN_CONFIG`, `TREE_CONFIG`) are frozen; tune them by editing the source.
- **One owner of the current world.** `Game` owns the current `World` and passes it to whoever needs it on each call; other classes do not keep their own reference.
- **World coordinates.** Tile `(tx, ty)` covers `x ∈ [tx, tx+1]`, `z ∈ [ty, ty+1]`; `y` is height. A building's `tx, ty` is the lowest-coordinate corner of its footprint.

### Style

- One class per file, the file named after the class (`Game.ts`). Stateless math stays as exported functions in camelCase files (`cameraMath.ts`, `noise.ts`).
- Every class member has an explicit `public`, `private` or `readonly` modifier; every method and function has an explicit return type.
- Data passed between classes is described by a named `interface` or type alias.
- Every public method has a doc comment: what it does and when to call it.
- No `enum` keyword (use `as const` objects); no factory functions returning object literals.
- Keep each source file under about 150 lines; split by responsibility when one grows.
- Tunable values live in one config object per area (`GAME_CONFIG`, `CAMERA_CONFIG`, `MAPGEN_CONFIG`).
- No image, model or audio asset files yet: shapes are built in code.
- No new dependencies without asking the owner.

### Rendering

- GPU resources are disposed when replaced: anything created for a world is removed and disposed on "New map" (`disposeObject`, each layer's `dispose()`).
- The scene is drawn at reduced resolution for the pixel look (`PixelRenderer`); compute cursor positions from the canvas's CSS box, never from its pixel size.
- Tile picking uses `raycastHeightfield` on the height grid, not a mesh raycast.

### Tests

- Tests live in `tests/`, one file per unit, and exercise real behaviour (a real `World`, real three.js geometry in Node) rather than mocks.
- New simulation rules and pure math are written test-first.
