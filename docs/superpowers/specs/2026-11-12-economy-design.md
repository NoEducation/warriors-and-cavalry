# Economy Stage — Game Time, Resources, Stockpile, Production

Date: 2026-11-12
Status: approved 2026-11-12
Builds on: `2026-11-12-stage2-world-objects-design.md` and `AGENTS.md` (all of
their rules still apply unless this document changes them).

## Goal

The world starts to run. Game time passes in fixed simulation ticks and is
shown in the HUD as a day and time of day. The player has wood, stone and
food; buildings cost resources; storage buildings hold them; production
buildings add to them over time.

Building placement on the grid already exists. Workers arrive in the next
stage; until then production buildings work on their own.

## Out of scope

Workers and population, food consumption, cutting down trees, day/night
lighting, gold and trade, saving, networking.

## Part A — Game time

- The simulation advances in fixed **ticks**, 10 per second of real time at
  normal speed. All simulation time is counted in whole ticks; nothing in
  `src/sim` reads the real clock.
- `World.tick(): void` advances the world by one tick. `World.tickCount` is
  the number of ticks since the world was generated.
- A game day is 2400 ticks (4 minutes of real time at normal speed). A new
  world starts on day 1 at 06:00.
- `src/sim/gameTime.ts` converts a tick count into `{ day, hour, minute }`;
  the minute is shown in steps of 10.
- `src/game/SimulationRunner.ts` turns real frame time into ticks: it
  accumulates elapsed time and reports how many ticks to run this frame, at
  most 10 per frame so a slow frame cannot snowball.
- Pause and speed: `Space` pauses and resumes; `+` and `-` step the speed
  through 1×, 2× and 4×. While paused the player can still look around and
  place or demolish buildings.
- HUD shows `Day 1 · 06:00`, followed by `· Paused` or `· 2×` when not at
  normal speed.

## Part B — Resources and storage

- Resources: `Wood`, `Stone`, `Food` (`src/sim/ResourceKind.ts`).
- `src/sim/Economy.ts` holds one amount and one capacity per resource. The
  `World` owns it; it changes only inside `World.apply` and `World.tick`.
- Capacity is the camp's base capacity plus what storage buildings add:

  | Source | Wood | Stone | Food |
  |---|---|---|---|
  | Base (always) | 100 | 100 | 100 |
  | Each Stockpile | +150 | +150 | — |
  | Each Granary | — | — | +200 |

- A new world starts with 100 wood, 40 stone and 50 food.
- An amount never exceeds its capacity. Anything that would overflow is lost.
  When a storage building is demolished and capacity drops below the amount,
  the excess is lost.

## Part C — Buildings and costs

Four new building kinds join Keep, Hovel and Woodcutter's hut:

| Building | Footprint | Cost | Extra placement rule | Role |
|---|---|---|---|---|
| Keep | 4 × 4 | 50 wood, 40 stone | — | none yet |
| Hovel | 2 × 2 | 15 wood | — | none yet |
| Woodcutter's hut | 2 × 2 | 20 wood | — | produces wood |
| Stockpile | 3 × 3 | 10 wood | — | stores wood and stone |
| Granary | 3 × 3 | 25 wood | — | stores food |
| Quarry | 3 × 3 | 30 wood | at least one `Rock` tile touching the footprint's outer edge | produces stone |
| Wheat farm | 4 × 4 | 20 wood | every footprint tile is `Grass` | produces food |

- Placing a building spends its cost. With too little of any resource the
  command is rejected with `NotEnoughResources` and nothing changes.
- Demolishing a building refunds half of each cost, rounded down, limited by
  capacity.
- The steepness limit now grows with the building: the allowed height
  difference across the footprint is `0.3 × the longer side` (0.6 for 2 × 2,
  0.9 for 3 × 3, 1.2 for 4 × 4). This also makes the Keep practical to place.
- New rejection reasons: `NotEnoughResources`, `NeedsRock`. The Wheat farm on
  sand is `BadTerrain`.
- Costs, footprints, storage and production values live in the per-kind data
  table in `src/sim/ObjectKind.ts`, not scattered in code.

## Part D — Production

Each production building works in cycles. When a cycle completes it adds its
yield to the economy and starts the next cycle.

| Building | Cycle | Yield | Works only when |
|---|---|---|---|
| Woodcutter's hut | 100 ticks (10 s) | 2 wood | at least one tree stands within 8 tiles of its footprint |
| Quarry | 150 ticks (15 s) | 2 stone | always |
| Wheat farm | 200 ticks (20 s) | 3 food | always |

- Trees are not used up in this stage.
- A building whose condition is not met, or whose resource is at capacity,
  does not progress; its cycle resumes when it can work again.
- Each building keeps its own cycle progress, in ticks. Buildings are
  processed in id order every tick, so the result is the same on every
  machine.
- `worldChecksum` now also covers the tick count, the resource amounts and
  every building's cycle progress.

## Part E — What the player sees

- **Resource bar** (top centre): `Wood 100/250 · Stone 40/250 · Food 50/100`.
  A resource at capacity is marked.
- **Clock** in the HUD, as in Part A.
- **Build bar:** seven buildings and Demolish, keys `1`–`8`. Each button shows
  the cost; a building the player cannot afford is dimmed but still
  selectable, so the ghost can show where it would go.
- **Ghost:** red when the spot is invalid or the cost cannot be paid. A
  rejected click shows the reason, for example `Cannot build: not enough wood`
  or `Cannot build: needs rock nearby`.
- **New building shapes**, generated in code like the existing ones:
  - Stockpile: a flat platform with stacks of logs and stone blocks. The
    stacks grow and shrink with the amount stored, shared evenly over all
    stockpiles.
  - Granary: a raised timber store with a pitched roof.
  - Quarry: a cut rock face with stone blocks.
  - Wheat farm: a fenced field whose crop grows through the cycle and is cut
    back when it completes.
- Hovering a production building names it in the HUD together with its
  state: `Woodcutter's hut — working`, `— no trees nearby`, `— storage full`.

## Architecture

- `src/sim/` gains `ResourceKind.ts`, `Economy.ts`, `gameTime.ts`,
  `Production.ts` (advances production buildings by one tick). `World` gains
  `economy`, `tickCount`, `tick()`.
- The world still changes only through `World.apply(command)` and
  `World.tick()`. Commands stay plain data. A later networking stage can send
  commands tagged with the tick they apply on; nothing here prevents that.
- `src/game/` gains `SimulationRunner.ts` (frame time → ticks, pause, speed).
  `Game` asks it how many ticks to run each frame and calls `World.tick()`.
- `src/render/` gains the four building shapes, a `StockpileStacks` helper
  that redraws stacks when amounts change, and the crop growth on farms.
- `src/ui/` gains `ResourceBar.ts`; `Hud` gains the clock line; `BuildBar`
  shows costs.
- Render and UI read the small amount of economy and production state they
  show (three amounts, a few buildings' progress) once per frame and touch
  the DOM or rebuild meshes only when a displayed value changed.

## Testing

Unit tests (Vitest):

- `gameTime`: tick 0 is day 1, 06:00; one day later is day 2, 06:00; minutes
  step by 10; midnight rollover.
- `SimulationRunner`: 0.1 s at 1× gives 1 tick; leftover time carries over;
  paused gives 0; 2× and 4× give 2 and 4; a 5-second frame gives at most 10.
- `Economy`: start amounts; add clamps at capacity and reports what was
  stored; spend refuses when short and changes nothing; capacity follows
  storage buildings; excess is lost when capacity drops.
- `World`: placing spends the cost; too little rejects with
  `NotEnoughResources`; demolish refunds half, limited by capacity; Quarry
  without adjacent rock rejects with `NeedsRock`; Wheat farm on sand rejects
  with `BadTerrain`; the steepness limit per footprint size.
- Production: a Woodcutter's hut near a tree adds 2 wood after exactly 100
  ticks and none after 99; none with no tree within 8 tiles; stops at
  capacity and resumes after spending; Quarry and Wheat farm cycles; two
  worlds given the same commands on the same ticks have equal checksums.
- Purity test still covers every file in `src/sim`.

Browser check: clock advances and pauses; speed changes; resource bar counts
up near a working Woodcutter's hut; costs are spent and refunded; stockpile
stacks grow; crop grows and resets; unaffordable building shows a red ghost
and a message; "New map" resets time and resources; no console errors.

## Done when

1. `npm test` and `npm run build` pass.
2. The browser check passes.
3. Frame rate is not visibly worse than before this stage.
4. Code is merged to `main` and pushed, with the repository owner as the only
   author on every commit.
