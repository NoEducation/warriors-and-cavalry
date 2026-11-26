# Terrain and tree detail

## Goal

Give the core landscape — grass, mountains, trees — more detail and depth while keeping the low-poly pixel look.
Render-only: the simulation, map generation and tile picking are untouched.

## What looked flat

- Grass is one green with a per-tile brightness hash, so it reads as a checkerboard with no larger structure.
- Rock is one grey; slopes, ridges and valleys barely show because ambient light (0.9) drowns the sun.
- Trees have one flat colour per part, so crowns read as silhouettes without volume.

## Design

1. **Lighting.** A hemisphere light (sky blue / earth brown) replaces most of the flat ambient light and a warmer,
   stronger sun comes in lower, so slopes facing away from it fall into shade. Light distance fog towards the
   background colour separates near from far.
2. **Terrain colour per vertex** (`terrainColor.ts`, pure functions, config `TERRAIN_LOOK_CONFIG`):
   - every vertex is coloured from its world position, so colour flows smoothly within a terrain type and the edges
     between types stay crisp;
   - grass blends lush, meadow and dry greens by two low-frequency noise fields, gets lighter with altitude, and keeps
     a small per-triangle speckle for pixel texture;
   - rock blends moss-grey on gentle slopes into dark cliff brown on steep ones, adds horizontal strata bands, and turns
     to snow on the highest, flatter vertices;
   - sand darkens to wet sand near sea level;
   - a curvature term (corner height versus its neighbours) darkens hollows and lightens ridges, a cheap ambient
     occlusion that makes relief readable from above.
3. **Trees.** Each crown part is shaded with a vertical gradient (dark underside, light top) and pines get more tiers.
   A soft dark disc under every tree grounds it on the terrain.

All variation is a pure function of the map seed and position, so a map still looks the same every time.
