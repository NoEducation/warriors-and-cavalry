# Stage 1 — Generated 3D Map Running in the Browser

Date: 2026-11-11
Status: approved 2026-11-11

## Goal

Open a browser page and see a procedurally generated 3D terrain map with a
pixelated look, viewed from a tilted top-down RTS camera that can pan, zoom
and rotate. The tile under the cursor is highlighted.

This is the first stage of a single-player castle-building strategy game in
the spirit of Stronghold. Multiplayer is planned for a later stage, so stage 1
must not make it harder (see "Multiplayer readiness").

## Out of scope

Buildings, units, resources, trees, economy, pathfinding, saving, sound, menus,
networking, mobile/touch input, map editor.

## Tech stack

- Node 26 (installed: 26.13.1)
- TypeScript 7, `strict: true`
- Vite 8 (newest release)
- Three.js 0.187 (rendering library; no game engine)
- Vitest 5 for unit tests
- No other runtime dependencies. No image, model or audio asset files.

## Architecture

Two layers with a one-way dependency: render reads sim, sim knows nothing
about render.

```
src/
  sim/                 plain TypeScript; no three.js, no DOM, no browser APIs
    rng.ts             seeded PRNG (mulberry32)
    noise.ts           seeded 2D value noise + fractal sum
    tiles.ts           TileType enum and per-type properties
    map.ts             GameMap data structure and accessors
    mapgen.ts          generateMap(params) -> GameMap
  render/              three.js; reads GameMap, never mutates it
    terrainMesh.ts     GameMap -> terrain geometry with vertex colours
    water.ts           flat water plane at sea level
    cameraRig.ts       RTS camera: pan, zoom, rotate, clamped to map
    picking.ts         screen position -> tile coordinates
    highlight.ts       outline on the hovered tile
    pixelRenderer.ts   low-resolution render, upscaled with hard pixels
    hud.ts             HTML overlay: seed, tile info, FPS, "New map" button
  main.ts              wires everything together, runs the frame loop
tests/                 Vitest tests for src/sim only
```

Each file has one job and should stay under roughly 150 lines.

## Map data

- Size: 128 × 128 tiles (a parameter, not a constant baked into code).
- Heights are stored per grid corner: a `Float32Array` of 129 × 129 values in
  world units. One tile is 1 × 1 world unit.
- Tile type is stored per tile: a `Uint8Array` of 128 × 128 values.
- Tile types: `Water`, `Sand`, `Grass`, `Rock`.
- `GameMap` exposes: `width`, `height`, `seed`, `heightAt(cx, cy)`,
  `tileAt(tx, ty)` (returns `undefined` out of bounds),
  `tileHeight(tx, ty)` (average of the four corners), `inBounds(tx, ty)`.

## Map generation

`generateMap({ seed, width, height })` returns a `GameMap`. Steps:

1. Height at each corner = fractal value noise (4 octaves) from the seed,
   multiplied by a radial falloff so the map edges sink below sea level and
   the map reads as an island or coast.
2. Tile type from the tile's average height and slope:
   - below sea level → `Water`
   - just above sea level → `Sand`
   - steep slope or high altitude → `Rock`
   - otherwise → `Grass`
3. Thresholds (sea level, sand band, rock slope, rock altitude) live in one
   exported config object so they are easy to tune.

Determinism rules for everything in `src/sim`:

- No `Math.random()`. All randomness comes from `rng.ts` and the seed.
- No `Math.sin`, `Math.cos`, `Math.pow`, `Math.exp`, `Math.log` and similar:
  their results can differ between JS engines. Use only `+ - * /`,
  `Math.floor`, `Math.sqrt`, `Math.abs`, `Math.min`, `Math.max`, `Math.imul`.
- Same seed and parameters must give a byte-identical map on any machine.

## Rendering

- **Terrain:** one mesh. Two triangles per tile, vertices not shared between
  tiles, flat shading, colour per tile from its type with a small
  deterministic brightness variation so large areas are not a single flat
  colour. `Water` tiles are drawn as seabed; the water plane covers them.
- **Water:** one semi-transparent flat plane at sea level.
- **Light:** one directional light plus ambient. No shadows in stage 1.
- **Pixel look:** the scene is rendered at a reduced resolution (window size
  divided by a pixel scale, default 3) and upscaled to the window with
  nearest-neighbour filtering. Pixel scale is a single config value.
  Known limitation accepted for stage 1: pixels shimmer slightly while the
  camera moves.
- **Camera:** perspective camera with a narrow field of view, tilted about
  55° down, orbiting a focus point on the ground.
  - Pan: `W A S D` or arrow keys, relative to the current camera rotation.
  - Zoom: mouse wheel, clamped between a minimum and maximum distance.
  - Rotate: `Q` / `E` rotate continuously around the focus point while held
    (any angle, no snapping).
  - The focus point is clamped to the map bounds.
  - Movement speed is frame-rate independent.
- **Picking:** a ray from the cursor is intersected with the terrain mesh and
  the hit point is converted to tile coordinates with `Math.floor`. Cursor off
  the map or over the HUD → no tile.
- **Highlight:** an outline following the four corner heights of the hovered
  tile; hidden when there is no tile.
- **HUD:** HTML overlay showing seed, hovered tile `x, y`, type and height
  (or `—`), FPS, and a "New map" button that picks a new seed and regenerates.

## Seed handling

- `?seed=<integer>` in the URL selects the map. Without it, seed `1` is used.
- "New map" generates a new seed, updates the URL without reloading the page,
  and rebuilds the terrain. Old geometry is disposed.

## Browser behaviour

- Canvas fills the window and follows window resizes.
- Mouse wheel does not scroll the page; right-click does not open the context
  menu over the canvas.
- If WebGL is unavailable, show a plain text message instead of a blank page.

## Multiplayer readiness

No networking code in stage 1. Only these constraints, which keep the door open:

- `src/sim` has no rendering or browser dependencies, so it can later run on a
  server under Node.
- The map is fully described by `{ seed, width, height }`, so clients can
  later generate identical maps from a few bytes instead of downloading them.
- The sim is deterministic (rules above).
- Render code never mutates sim state.

## Testing

Unit tests (Vitest, `src/sim` only):

- Same seed → identical height and tile arrays; different seed → different.
- PRNG and noise return values in their documented range and are repeatable.
- `tileAt` / `inBounds` at the edges and outside the map.
- Generated map contains both `Water` and `Grass`, and every border tile is
  `Water`.
- A lint-style test that fails if any file in `src/sim` imports `three` or
  uses `Math.random`.

Manual check in the browser (render layer): map visible, pan/zoom/rotate work
and stop at the limits, highlight follows the cursor, "New map" changes the
terrain, same `?seed=` gives the same map after reload, resize works, no
console errors.

## Done when

1. `npm run dev` opens the map in the browser and the manual check passes.
2. `npm test` passes.
3. `npm run build` passes with no TypeScript errors.
4. The scene holds 60 FPS on this machine at 128 × 128.
5. The code is pushed to the GitHub repository.
