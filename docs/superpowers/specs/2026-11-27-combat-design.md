# Combat: soldiers, raider waves and breakable buildings

## Why

The owner: "Let's proceed to combat". The game is in the spirit of Stronghold, and so far nothing threatens the camp:
walls, gates and towers are decoration, and food (since PR #10) has no use. This first combat version gives food its
job (training soldiers), gives the castle pieces a job (keeping raiders out), and gives the player something to fight.

## Goals

- The player builds a **Barracks**, trains **Spearmen** and **Archers** there for food plus wood, selects them and
  orders them to move and attack.
- **Raider waves** arrive on a timer once a Keep stands, march on the Keep, kill soldiers and workers in their way,
  and hack through walls, gates, towers and any building that blocks them.
- Every building has **hit points**; a wrecked building is removed (its worker dies with it, no refund).
- Losing the Keep shows a **defeat banner**; waves stop until a Keep stands again.
- Everything stays deterministic and multiplayer-ready: state changes only through `World.apply` and `World.tick`,
  per-tick loops in ascending id order, integer maths, all of it in the world checksum.

## Non-goals (later)

- An AI opponent with an economy, enemy buildings, or a second human player.
- Cavalry (Knight), siege engines, towers that shoot by themselves, boiling oil, moats.
- Food upkeep: soldiers cost food once, at training (owner).
- Unit collision or formations beyond spreading over the tiles around a move target.
- Repairing buildings, healing units, morale, retreating, fleeing peasants.
- Saving the selection or orders across "New map".

## Anti-goals

- Fighting that differs between two equal worlds given the same commands (any float, `Math.random`, `Date`, map
  iteration in non-id order, or unit order depending on render).
- Soldiers taking places in the worker housing: the army must never take jobs from the economy (owner).
- Combat logic in render, UI or game code: they read views and send commands only.

## Owner decisions

| Question | Answer |
| --- | --- |
| Opponent | Raider waves from outside, marching on the Keep. No AI economy. |
| Soldier types | Spearman (cheap melee) and Archer (ranged, can stand on walls and towers). |
| Training | A new Barracks building; click it and pay to queue a soldier. Soldiers have their own limit, not the housing. |
| Food | Paid once per soldier at training (with wood). No upkeep. |
| Siege | Every building has hit points. Gates let only the player's people through. Raiders cut off from the Keep hack at the building in their way. Towers do not shoot; archers on them do. |
| Defeat | Keep destroyed: a "Your Keep has fallen" banner, waves stop; building a Keep starts them again. No game-over screen. |
| Waves | First wave after ~5 minutes of a Keep standing, then one every 3 minutes, each one raider bigger (2, 3, 4…), shifting toward archers. The HUD shows the timer. |

## Approaches

1. **A separate army part of the simulation (chosen).** A new `Army` (in `src/sim/`) owns every soldier and raider as
   one `Unit` record with a side, kind, hit points, position and order; `Structures` keeps building hit points;
   `Barracks` training queues and a `RaidSchedule` sit beside them. New commands go through `World.apply`; the army
   ticks after the peasants. The step-walking code is made generic over anything that walks, so units and peasants
   share the path-finder and step timing. The economy code stays as it is.
2. **Soldiers as peasants** with extra states in `Population`. Reuses the most, but tangles fighting into the economy,
   whose housing, job and death rules all assume workers.
3. **Units as map objects** in `ObjectIndex`. Objects there are frozen tile footprints; moving units would fight the
   index, the placement rules and the checksum on every step.

The owner left the how to me; 2 and 3 work against the code's layout, so 1.

## Design

### New data (my calls on all numbers; they live in frozen config objects)

`ObjectKind.Barracks = 14`: 3x3, cost 40 wood + 10 stone, Grass or Sand, no housing, no production, no worker.
New `ObjectKindInfo` fields:

- `hitPoints` — 0 means it cannot be attacked (Tree, Stump). Keep 600, Hovel 80, Woodcutter's hut 80,
  Stockpile 80, Granary 120, Quarry 120, Wheat farm 80, Barracks 200, Wall 150, Gate 200, Tower 400, Stairs 60.
- `soldierRoom` — soldiers it lets the player have: Barracks 8, every other kind 0.

`UnitKind = { Spearman: 1, Archer: 2 }` and a frozen `UNIT_KINDS` table (`src/sim/UnitKind.ts`):

| | Spearman | Archer |
| --- | --- | --- |
| Cost | 10 food + 5 wood | 12 food + 10 wood |
| Train ticks | 100 | 120 |
| Hit points | 60 | 35 |
| Damage per strike | 10 | 6 |
| Ticks between strikes | 10 | 15 |
| Reach (tiles, Chebyshev) | 1 | 6, or 8 while standing on a wall or tower top |
| Sight (tiles, Chebyshev) | 6 | 8 |
| Straight / diagonal step ticks | 4 / 6 (as peasants) | 4 / 6 |

Raiders use the same two kinds and numbers. Peasants get 20 hit points; they do not fight back.

Distances are Chebyshev (`max(|dx|, |dy|)`) on whole tiles, so no square roots or floats. A unit's position for
range checks is the tile it stands on (`tx, ty`), or mid-step, the tile it steps from. A building is in reach when
any of its footprint tiles is.

`Side = { Player: 0, Raider: 1 }`.

### Unit record and views

`Unit` (mutable, `src/sim/Unit.ts`) with a read-only `UnitView`: `id`, `side`, `kind`, `hitPoints`, the same walking
fields as a peasant (`tx, ty, nextTx, nextTy, stepProgress, stepTicks, path, pathIndex, walkMode`), `cooldown` (ticks
until it may strike again), `order` (below), `targetUnitId`, `targetObjectId`, `lastStrikeTick` (-1 before any, for
the render's swing and arrow), and `waitTicks`. Unit ids come from their own counter starting at 1, never reused.

The walker today takes a `Peasant`. It gets an interface `Walker` (the walking fields plus `startWalk`,
`stepToNextTile`, `advanceStep`) that both `Peasant` and `Unit` implement, and `PeasantWalker` becomes `StepWalker`
over that interface. The walk-class function is passed per search, so raiders can use their own.

### Walking rules for each side

- Player soldiers walk like peasants: through gates, along the wall walk, and in `Climb` mode when the move target is
  a wall or tower top (so archers can be sent onto walls), `Ground` mode otherwise.
- Raiders see **gates as blocked** and never climb (`Ground` mode, with the usual `Down` fallback). That is how a gate
  keeps them out.
- Units never block each other or peasants; several may share a tile (the render spreads them).

### Orders and behaviour (one tick of the army, units in ascending id order)

A unit with `hitPoints <= 0` (killed earlier this tick) does nothing. `cooldown` counts down by one each tick. Then:

**Player soldiers** have an `order`:

- `idle` — standing. Picks the nearest raider it may strike (see edge cases) within sight (Chebyshev, ties by lowest id). A Spearman walks to it and
  strikes when in reach; an Archer only shoots when it is in reach and never walks on its own (so archers stay on the
  walls). With no raider in sight it stands.
- `move` — walking to a tile; ignores enemies until it arrives, then becomes `idle`.
- `attack` — a named raider: walks until in reach and strikes; Archers walk too under this order. When the raider
  dies, `idle`.

**Raiders**: the same nearest-target pick within sight, but they take both player soldiers and peasants. Without a
target in sight they march: to the Keep's access tiles (lowest-id Keep), else, with no Keep, to the nearest standing
building (Chebyshev to its footprint, ties by lowest id). Standing next to the building it marches on (in reach), a
raider strikes it.

**Breaching.** When a raider's march finds no path (the Keep is walled in), it searches again over the tiles with
every building counting as ground (water still blocked). The first tile of that path covered by a building is the
building to break; the raider walks to the last free tile before it and strikes it until it falls, then marches
again. Archers break buildings too (my call: they shoot at the wall). A raider remembers its breach target, so a group
hacks at one hole.

**Chasing.** A unit walking to a moving target searches again when the target has moved from the tile its path ends
next to, but not more than once every 10 ticks (staggered by unit id: `(tick + id) % 10 === 0`), and when its next
step is blocked. Failed searches wait `retryTicks + id % retrySpread` like peasants.

**A strike** when `cooldown === 0` and the target is in reach: subtract the kind's damage from the target's hit
points, set `cooldown`, set `lastStrikeTick`. Damage lands at once (no projectile in the simulation; the render draws
the arrow). A unit or peasant at 0 or below is dead at once: it cannot act later in this tick and is removed at the
end of the army tick, in ascending id order. A building at 0 or below is removed at once through
`ObjectLifecycle.remove` (no refund), which kills its worker and drops its housing, storage and soldier room, and
tells the listeners `removed`.

### Edge cases settled after review

- **Wall tops are out of melee reach (owner).** A unit standing on a wall or tower top (walk class `Top`) can be struck
  only by Archers. Spearmen do not pick such a unit as a target at all.
- **A wall piece falls under units (my call).** Its tile becomes ground, so the units on it simply stand on the ground
  there (the render drops them to the ground height); nobody dies of it. Stairs beside it stay (`needsWall` is a
  placement rule only). This is what peasants already do.
- **Unreachable targets (my call).** A unit only keeps a target it can strike from where it stands or walk to. When a
  chase search fails, it forgets that target and skips it for `retryTicks + id % retrySpread` ticks, then marches (a
  raider) or stands (a player soldier). Chasing never breaches; only marching does.
- **What raiders strike (my call).** Only the unit or peasant they target, the building they march on, or the
  building they breach. A hut beside the route is not hit unless it is in the way.
- **Peasants as targets (my call).** Any living peasant, in any state, standing on a tile within sight; workers stand
  on their building's access tiles, never inside it.
- **A trained soldier with no free tile (my call).** The finished front item stays at its full progress, holding its
  queue slot and its place against the room, and appears on the first tick an access tile is free.
- **Room below the count (my call).** `soldiers.room` may read below `soldiers.count` after a Barracks falls; the room
  only limits `trainUnit`.

### Training

- Command `{ type: 'trainUnit', barracksId, unitKind }`. Fails with `UnknownObject`, `NotABarracks`,
  `UnknownUnitKind`, `NoSoldierRoom` (living player soldiers plus all queued ones would exceed the total soldier room)
  or `NotEnoughResources`. On success the cost is paid and the unit joins that barracks' queue (at most 5 queued per
  barracks: `QueueFull`).
- Each tick the front of every barracks' queue (ascending barracks id) counts down; when done the soldier appears on
  the barracks' first access tile (the Keep's tile order) as `idle`. With no access tile free it waits, still queued.
- A destroyed or demolished barracks loses its queue (no refund for queued soldiers; my call). Soldiers over the room
  after a barracks is lost stay alive; the player just cannot train until under the room again.

### Orders as commands

- `{ type: 'orderMove', unitIds: number[], tx, ty }` — each listed living player unit gets a `move` to one of the
  walkable tiles nearest (tx, ty): the target tile first, then rings outward in a fixed order, one tile per unit in
  ascending unit id order, so a group spreads out. Unknown, dead or raider ids are skipped; fails `UnknownCommand`
  when malformed (not safe integers) and `NoUnits` when no listed id is a living player unit.
- `{ type: 'orderAttack', unitIds: number[], targetUnitId }` — fails `UnknownUnit` when the target is not a living
  raider; else as above.
- A future multiplayer version adds the issuing side to these commands; this version assumes the player.

### Raid schedule

- Counts only while a Keep stands: `ticksToNextWave` starts at 3000 (5 min) and resets to 1800 (3 min) after each
  wave. Wave `n` (from 1) has `n + 1` raiders, of which `floor(n / 2)` are Archers.
- Where they appear: a direction picked by `hash2(seed, wave, 0)` out of 8 compass directions; from the Keep's centre
  48 tiles that way (clamped inside the map), then the nearest tile, searched ring by ring, that is ground and from
  which a breach search reaches the Keep. With none in 8 directions the wave is skipped (an island Keep).
- `keepFallen`: set when raiders destroy the last Keep; cleared when a Keep stands again. Raiders already on the map
  keep fighting (they march on the nearest building).
- `World.raids` view: `{ wave, ticksToNextWave (null while no Keep stands), keepFallen, raidersAlive }`.

### World surface

- `World.tick()` order: peasants, production and felling, stumps, then the army: training, raid spawn, units, removal
  of the dead.
- New reads: `units(): Iterable<UnitView>` (ascending id), `unitById`, `buildingHitPoints(objectId)` (current and
  max; null when not attackable), `peasant hit points` on `PeasantView.hitPoints`, `soldiers: { count, room }`,
  `trainingQueue(barracksId)`, `raids`.
- `ObjectLifecycle` tells `Structures` and `Army` (training queues, soldier room, breach targets) about every add and
  remove, in its fixed follower order.
- `worldChecksum` adds: building hit points of damaged buildings (id, hp), peasant hit points, every unit (all fields a
  later tick reads, like `feedPeasant`), every barracks queue, the raid schedule, and the next unit id.

### Render (`src/render/`)

- `UnitLayer`, built like `PeasantLayer` on the same rig, parts and poses: player soldiers in blue tunics, raiders in
  red; Spearmen carry a spear, Archers a bow. A strike swings the arms for a few ticks after `lastStrikeTick`; an
  archer's strike draws a short-lived arrow flying to the target's position.
- Units sharing a tile are offset a little by id so they do not overlap exactly.
- A small health bar floats over each damaged unit, and over each damaged building. Selected units have a ring.
- Units on a wall top stand at the wall-walk height (the existing `walkHeight`).

### Input and UI

- Build bar: Barracks under the Castle tab, key `B`.
- **Selecting** (no build tool chosen): left-click selects the player unit nearest the clicked ground point within
  one tile (else clears the selection); a left drag draws a box and selects the player units whose screen positions
  fall in it. Shift adds to the selection. Escape clears it. Selection is game-layer state, pruned of dead units every
  frame.
- **Ordering**: right-click with a selection: on a raider (nearest within one tile of the ground point) sends
  `orderAttack`, else `orderMove` to the tile. With a build tool chosen, right-click still drops the tool.
- **Barracks panel**: left-clicking a Barracks (no tool) opens a small panel: Spearman and Archer buttons with their
  costs (dimmed when unaffordable or no room), the queue with the front item's progress, and `soldiers n / room`.
  It closes on Escape, on a right-click, or when the barracks is gone.
- Resource bar: a soldiers slot `n/room`. HUD: `Raiders in 2:31` while counting, `Raid! 3 raiders` while raiders
  live; the defeat banner "Your Keep has fallen" while `keepFallen`. All new colours as variables in `colors.css`.

## Determinism

Ids ascend in every loop; target ties break by lowest id; distances are integer Chebyshev; the spawn direction comes
from `hash2(seed, wave, 0)`; timers are whole ticks. The army never reads render or input state. Two worlds with the
same seed and the same commands at the same ticks give equal checksums (tested).

## Tests (test-first, real `World`)

- Barracks: placing one gives soldier room 8; `trainUnit` pays food and wood, the soldier appears after the train
  ticks on the barracks' access tile; failures (`NoSoldierRoom`, `NotEnoughResources`, `QueueFull`, `NotABarracks`)
  change nothing; a demolished barracks drops its queue.
- Soldiers do not change the worker count or the housing.
- `orderMove` walks a group to spread tiles; archers ordered onto a wall top climb by the stairs.
- A Spearman ordered to attack a raider walks up and kills it in the expected number of strikes; an idle Archer on a
  wall shoots a raider within 8 tiles and does not leave the wall.
- Raiders appear when the timer runs out (and not without a Keep), march to the Keep and damage it; the Keep at 0
  removes it and sets `keepFallen`; a new Keep clears it and restarts the timer.
- A raider kills a peasant; the building gets a new worker afterwards.
- A gate keeps raiders out; a Keep fully walled in makes raiders break the wall piece in their way, and they walk in
  through the hole.
- Wave sizes and archer counts follow `n + 1` and `floor(n / 2)`.
- Checksum: two equal worlds with equal commands stay equal over a long fight; a different command changes it.
