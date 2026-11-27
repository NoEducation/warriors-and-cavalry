# Worker economy: no idle pool, food for soldiers only

## Why

Combat comes next, and soldiers will be what costs food. Before that, the owner wants the peasant economy simpler:
peasants exist only as workers of a building, their number is capped by homes, and food is no longer spent on them.

## Today

- Peasants arrive one every 50 ticks at the lowest-id Keep while `count < housing` and food ≥ 5; each arrival costs
  5 food. Nothing else spends food (there is no eating, starvation or happiness).
- Arrivals wait idle around the Keep (`IdleStands`) or as lookouts on the wall walk (`WallLookouts`), and each tick
  idle peasants take the lowest-id vacant job.
- A worker whose building is removed, or who cannot reach its building, a store or a tree, goes idle.
- Buildings are complete the moment a `placeBuilding` command succeeds; there is no construction phase. So
  "finished" and "placed" are the same moment.
- Housing: Keep 4, Hovel 4.

## Rules (owner)

1. **Food is only for soldiers.** Peasants cost no food. Food stays a resource (farms, granary, resource bar); nothing
   spends it until soldiers exist.
2. **No idle pool.** No peasant exists without a workplace. Idle stands and wall lookouts are removed (owner: drop
   them; soldiers can man walls later). Wall-walk pathing itself stays.
3. **Workers spawn for buildings.** On every tick, each production building without a worker (ascending building id,
   skipped ones left out) gets a new worker while `count < housing`. No arrival timer.
4. **The limit is the housing, live.** Placing a Hovel or Keep raises the limit at once (placement is completion);
   waiting buildings get workers on the next tick.
5. **Workers die with their building.** Removing a production building removes its worker at once (load lost, tree
   claim freed), so its place in the limit goes to the next waiting building on the next tick.

## Decisions

- **Spawn point (owner): at the Keep.** The new worker appears on the Keep's first free access tile (the order
  `Arrivals` uses today) and walks to its building. Without a Keep, nobody spawns and buildings show `noWorker`.
- **Unreachable on spawn (my call):** before spawning, the worker's walk from the Keep tile to the building is searched.
  With no path, no worker is created and the building is skipped for `unreachableSkipTicks` (status
  `workerCannotReach`), as job assignment does today. This keeps a hopeless worker from taking a place in the limit.
- **Limit drops below the count (owner): newest die.** When a home is removed, workers die highest peasant id first
  until `count ≤ housing`. Their buildings stand vacant and get workers again when there is room.
- **Cut off after spawning (owner): keep the job and retry.** A worker whose way to its building, a store or (a
  woodcutter) any tree is blocked stays assigned, waits `retryTicks + id % retrySpread` ticks where it stands and
  searches again. The building shows `workerCannotReach` meanwhile (a woodcutter with no tree keeps `noTrees`).
- **Peasant states (my call):** the `idle` state, `goIdle`, stands and `standOn` go. A peasant is created with its
  workplace in state `toWork`. The render pose `'idle'` (standing still) is unrelated and stays.
- **UI (my call):** the resource bar's peasant slot shows `workers/limit` (e.g. `3/8`) without the "idle" part. Food
  stays in the bar.
- **Removed:** `POPULATION_CONFIG.arrivalTicks` and `arrivalFoodCost`, `World.arrivalTimer` (and its place in the
  checksum), `PopulationSummary.idle`, `IdleStands`, `WallLookouts`, the stand fields in `PeasantView` and the
  checksum.

## Approaches

1. **Reshape `Population` in place (chosen).** `Arrivals` becomes a `Housing` class (homes, limit, Keep spawn tile);
   `Population.tick` spawns workers for vacant jobs, removes the idle machinery, and `WorkerTrips` waits instead of
   going idle. Small, keeps the tested trip and woodcutter code.
2. **Keep a hidden pool**, spawning peasants instantly and letting job assignment pick them up the same tick. Less code
   churn but keeps the idle state alive for no gameplay reason and invites a pool to reappear.
3. **Workers as part of each building** (production owns its worker). Cleaner ownership, but rewrites trips,
   woodcutting and statuses for little gain now.

## Determinism

Spawning walks buildings in ascending id order and gives ids in order; deaths walk peasants by descending id. No
timers beyond whole ticks, nothing outside `src/sim/`. Changes only through `World.apply` (placement, demolition) and
`World.tick` (spawning, walking).

## Tests (test-first, real `World`)

- Placing a production building with a Keep and room spawns its worker at the Keep on the next tick; it walks there
  and works; no food is spent.
- No worker spawns over the limit; placing a Hovel lets the waiting building's worker spawn on the next tick.
- Buildings get workers in ascending id order when the limit frees.
- Demolishing a workplace removes its worker; another waiting building gets one.
- Demolishing a Hovel kills the newest workers until within the limit; their buildings become vacant.
- No Keep, no spawn; an unreachable building is skipped and shows `workerCannotReach`.
- A worker walled in after spawning keeps its job, waits and resumes when the wall is demolished.
- Determinism checksum still matches for two equal worlds.
