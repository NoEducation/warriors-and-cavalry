# Peasants Stage — Peasants, Pathfinding, Supply Chain

Date: 2026-11-25
Status: approved 2026-11-25 (builder check done)
Builds on: `2026-11-12-economy-design.md` and `AGENTS.md` (all of their rules
still apply unless this document changes them).

## Intent

The village comes alive in the simplest form that still has all three core
pieces: peasants who exist and walk, a path-finder that routes them across the
map, and goods that physically travel from where they are made to where they
are stored. The owner asked for core components "as simple as possible"; every
choice below favours the smallest thing that makes the three pieces real.

## Goals

- Peasants arrive at the Keep while there is housing and food to pay for them.
- Each production building gets one worker. Production advances only while its
  worker is at the building.
- At the end of a cycle the worker carries the batch to the nearest storage
  place and walks back. Resources are added to the totals only on delivery.
- A deterministic tile path-finder in the simulation layer routes every walk.
- Peasants are drawn as small figures moving smoothly, carrying a visible
  bundle while delivering.
- The HUD shows the population.

## Non-goals (later stages)

Food consumption and hunger, cutting down trees, a worker for storage
buildings, more than one worker per building, roads, selecting or ordering
individual peasants, peasants blocking each other, happiness, saving.

## Anti-goals

- Anything in `src/sim` that is not deterministic, or that a later network
  stage could not replay from commands and ticks.
- A pathfinding cost that makes ticks slow: a full search across the 512 × 512
  map every tick, or one search per peasant per tick.
- Peasants that get stuck forever with no visible reason.

## Approaches considered

- **A. Counted workers, no walking.** A building works only when a peasant is
  assigned; peasants are just a number. Rejected: no pathfinding and no
  movement, which is most of what was asked for.
- **B. Workers carry goods to storage (chosen by the owner).** Each producer
  has one worker who walks there, works the cycle, carries the batch to the
  nearest storage place and walks back.
- **C. Full Stronghold chain.** Workers fetch from sources (fell a tree, cut
  rock), then carry. Rejected for now: needs tree removal, more worker states
  and tuning, about twice the work of B. B's structure leaves room for it.

## Design (decided)

### Population

- The **Keep** is where peasants arrive. With no Keep on the map, nobody
  arrives. With several, the one with the lowest id is used.
- **Housing**: each Keep houses 4, each Hovel 4. Stored in the `OBJECT_KINDS`
  table as `housing`.
- **Arrival**: while population is below housing and food is at least 5, one
  peasant arrives every 50 ticks (5 s). Arrival costs 5 food. The arrival timer
  counts up only while both conditions hold and resets to 0 whenever either
  fails, so the first peasant arrives 50 ticks after a Keep is placed. *(Builder
  call.)*
- A new peasant appears on the walkable tile next to the Keep found first by
  the rule in *Building access* below.
- **Leaving**: if housing drops below the population (a Hovel or Keep is
  demolished), peasants leave until it fits again: idle peasants first, highest
  id first, then working peasants by highest id. A leaving peasant simply
  disappears; anything it was carrying is lost.
- The starting world has no peasants. Start amounts stay as they are
  (100 wood, 40 stone, 50 food); a Keep costs 50 wood and 40 stone, so the
  player can afford it at the start.

### Jobs

- Every building with `production` has one **job**. Storage buildings, Hovels
  and the Keep have none.
- Each tick, each idle peasant (ascending peasant id) takes the vacant job of
  the building with the lowest id. A building is vacant when it has no worker.
- A worker that cannot find a path to its workplace gives the job up and
  becomes idle, and that building is skipped by job assignment for the next
  200 ticks (it shows `worker cannot reach` meanwhile), so an unreachable
  building does not hold a peasant forever while others stay empty. *(Builder
  call.)*
- When a building is demolished its worker becomes idle where it stands,
  dropping anything it carried (lost).
- The player does not assign anyone in this stage.

### A worker's cycle (supply chain)

States: `idle`, `toWork`, `working`, `toStore`, `toWorkBack`.

1. `toWork`: walk to one of the workplace's access tiles.
2. `working`: stand at the building. The building's production advances only
   in this state, with the existing rules (Woodcutter needs trees within 8
   tiles; a cycle does not start or advance while that resource is at
   capacity). When the cycle completes, the worker picks up the yield as a
   **load** (`resource`, `amount`) and moves on. The yield is no longer added
   to the economy at cycle end.
3. `toStore`: walk to the nearest **storage place** for the load's resource:
   - wood and stone: Stockpiles and the Keep;
   - food: Granaries and the Keep.
   "Nearest" is the one the path-finder reaches with the shortest path
   (ties: lowest id). This is one search with every candidate as a goal,
   stopping at the first goal reached, not one search per candidate.
   *(Builder call.)* The Keep counts as storage because it
   holds the camp's base capacity (100 of each).
4. On arrival the load is added to the economy (clamped to capacity; excess
   lost, as today). The worker then walks back (`toWorkBack`, same as
   `toWork`) and the cycle repeats.
- If no storage place for the load exists, the worker waits at the workplace
  holding the load and tries again every 50 ticks.
- If the target storage is demolished on the way, the worker picks a new
  target from where it stands.
- Hover text for a producer gains a status: `no worker`, and while the worker
  is away the building shows `worker delivering`; during the first walk to
  work it shows `worker on the way`. Existing statuses (`working`,
  `no trees nearby`, `storage full`) stay.

### Movement

- Peasants are not map objects: they do not occupy tiles and do not block
  each other or building placement.
- Position: the tile a peasant is on plus the next tile on its path and a
  step progress. A straight step takes 4 ticks, a diagonal step 6 ticks
  (whole-number ticks keep it deterministic; at 10 ticks per second that is
  2.5 tiles per second).
- The game draws a peasant interpolated between its tile and the next one, and
  between the last two ticks (smooth even at low tick counts per frame).

### Pathfinding

- A* on the tile grid in `src/sim`, 8 directions, step cost 10 straight and
  14 diagonal. A diagonal step is allowed only when both side tiles are
  walkable (no corner cutting).
- **Walkable**: inside the map, not `Water`, and not covered by a building.
  Trees and empty `Rock`, `Sand` and `Grass` tiles are walkable.
- The heuristic is the octile distance. Ties are broken by a fixed order (the
  node with the lower `ty * width + tx` first) so the same inputs always give
  the same path.
- **Search limit**: a search stops after expanding `PATH_CONFIG.maxExpanded`
  tiles (start value 65 536, a quarter of the map) and reports "no path". This
  bounds the worst case on the 512 × 512 map while still reaching buildings
  far across it. The value lives in one config object and may be tuned. A
  search may have several goal tiles. *(Builder call.)*
- A path is computed once when a trip starts, not every tick. A trip
  remembers its goal **building**, not a goal tile. The peasant searches again
  from its current tile when the next tile on its path becomes unwalkable, and
  when it reaches the end of its path but is not on a walkable tile sharing an
  edge with the goal building's footprint. Every new search works out the goal
  tiles again (and, when delivering, the storage target). *(Builder call.)*
- A peasant standing on a tile that became unwalkable may still search from
  it (the start tile is exempt from the walkable rule).
- When no path exists, the peasant waits where it is and tries again every
  50 ticks; its building shows `worker cannot reach`.
- **Building access**: a building's **access tiles** are the walkable tiles
  sharing an edge with its footprint. A search for a building has all of them
  as goals, and a peasant standing on any of them has arrived. A building with
  none cannot be reached. A new peasant appears on the Keep's first access
  tile in the fixed order bottom edge (high `ty`) left to right, then right
  edge top to bottom, then top edge, then left edge. *(Builder call; replaces a
  single access tile so a building placed on one side does not break trips.)*

### Simulation structure and determinism

- New in `src/sim`: `Peasant` state, a `Population` that owns peasants,
  arrivals, leaving and jobs, and a `PathFinder`.
- `World.tick()` order: arrivals and leaving → job assignment → each peasant
  advances (ascending id) → production advances for buildings whose worker is
  working. Production no longer adds yield itself; it hands the load to the
  worker.
- Peasants have their own increasing ids, never reused.
- `worldChecksum` also covers every peasant (id, state, tile, next tile, step
  progress, load, workplace) and the arrival timer.
- The world changes only through `World.apply` and `World.tick`; render and
  UI only read it.

### What the player sees

- Peasants: small low-poly figures (body and head), drawn with instancing.
  While carrying, a small bundle in the resource's colour (wood brown, stone
  grey, food gold) is shown on the figure.
- Resource bar gains `Peasants 3/8`, and `(2 idle)` when any are idle.
- No new buttons or keys.

## Left to the builder

- File and class names beyond those above, and how `Population`, `Peasant`
  and `PathFinder` split their work, within `AGENTS.md` rules.
- The open-set data structure for A* (a binary heap is expected).
- The figure's exact shape and colours, as long as a peasant reads as a person
  at the default zoom and carrying is visible.
- How the renderer gets the tick fraction for interpolation.

## Testing

- Path-finder: straight and diagonal paths on an open map; goes around a
  building and around water; no corner cutting; no path when the goal is
  walled off; the search limit returns "no path" without hanging; the same
  inputs give identical paths; a 300-tile path on a generated 512 map takes
  under 20 ms (generous limit; report the time).
- Population: no arrivals without a Keep, without housing or with under 5
  food; one arrival every 50 ticks costing 5 food; Hovels raise housing;
  demolishing a Hovel makes the highest-id idle peasants leave first.
- Jobs: an idle peasant takes the lowest-id vacant job; demolishing the
  workplace makes its worker idle and drops its load.
- Supply chain: a Woodcutter's hut with trees, a worker and a Stockpile adds
  2 wood only when the worker arrives at the Stockpile, not at cycle end;
  with no Stockpile the Keep receives it; with no storage place at all the
  worker waits; demolishing the target storage on the way re-routes.
- Determinism: two worlds from the same seed with the same commands on the
  same ticks have equal checksums after 3000 ticks; purity and layer tests
  still pass.
- Speed: 3000 ticks with 40 peasants on a generated 512 map under 500 ms
  (generous limit; report the time).

Browser check: place a Keep; peasants arrive and food drops by 5 each; place a
Woodcutter's hut, Stockpile and Hovel; a peasant walks to the hut, then
carries wood to the Stockpile and walks back; wood rises on delivery; a
building placed across a walking peasant's path makes it re-route; the
population line in the resource bar is right; "New map" clears peasants; no
console errors; frame rate not visibly worse.

## Done when

1. `npm test` and `npm run build` pass.
2. The browser check passes.
3. Code is merged to `main` and pushed, with the repository owner as the only
   author on every commit.
