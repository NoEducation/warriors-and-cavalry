# Wall stairs and the wall walk

## Intent

The owner wants stairs that can be placed against walls, and people who can climb up and walk along the walls. It is
groundwork for soldiers and archers, which come later: the wall walk must work now and be ready for them, but everyday
peasant life should not change around it.

## Goals

- A **Stairs** piece the player places against a wall or tower.
- A **wall walk**: the tops of Wall and Tower pieces are walkable, reached only by stairs.
- Someone actually climbs now, so it can be seen and tested before soldiers exist.
- Walking stays deterministic and cheap; the simulation stores no new per-peasant level.

## Non-goals

- Soldiers, archers, orders to move units, combat, enemies using stairs.
- Walking over gates (the walk stops at a gate; see Approaches).
- Rotating stairs by hand, stairs longer than one tile, ladders or siege equipment.

## Anti-goals

- Peasants must not start using walls as shortcuts on their work and delivery trips. A wall still forces them to a
  gate, as today.
- A peasant must never step off a wall top straight onto the ground.

## Approaches

1. **The wall tile is its own top (picked by the owner).** A Wall or Tower tile is never walkable on the ground, so the
   tile stands for its walk. Path finding gains a rule for each step (from tile, to tile). Height comes from the piece
   under a walker, so no peasant carries a level. The walk is broken at gates, which are the passage below.
2. A true second level for every tile, with each peasant on a level. Handles walking over gates and later bridges, but
   doubles the path-finder's arrays and touches every walking rule, the checksum and peasant drawing. Too big for
   groundwork.
3. Stairs drawn only, walls stay solid. Nobody could climb, which is half of the request.

## Design

### The Stairs piece

- New `ObjectKind.Stairs` (13): a castle piece (buildable, allowed on rock), 1 x 1, cost **3 stone** *(my call: between a
  wall at 2 and a gate at 6)*. Half back when demolished, as for every building.
- Placement: the usual rules, plus a new failure **`NeedsWall`**: one of its four edge neighbours must be a Wall or
  Tower tile. Checked in `placementRules` after `Occupied`.
- In the Castle build bar after Tower, label `Stairs`, a stairs icon drawn in code, key **`KeyT`** *(my call; it is free
  today — the builder checks)*.
- Demolishing the wall a stair leans against leaves the stair standing; it just leads nowhere.

### Walk tiles and step rules (sim)

Three kinds of tile matter to a walker:

| Tile | Ground walkable | Walk tile |
| --- | --- | --- |
| Free, tree, stump, gate (as today) | yes | no |
| Stairs | yes | no, but joins ground and walk |
| Wall, Tower | no | yes |

The step rule from tile A to an 8-neighbour B, both inside the map:

- ground → ground: as today (both ground walkable; diagonals need both side tiles ground walkable).
- ground ↔ stairs: like ground → ground (a stair is ground walkable).
- stairs → walk tile, walk tile → stairs: only straight (edge) steps; any walk tile beside the stair *(my call: the
  stair is drawn climbing toward one neighbour, but the rule does not care which; see Rendering)*.
- walk → walk: straight steps always; a diagonal step when both ends are walk tiles, whatever the side tiles are
  *(wall lines are 8-connected Bresenham runs whose diagonal pieces join at the corner, so the walk must follow them)*.
- walk → ground (not stairs), ground → walk: never.

Two search modes, both using these rules:

- **Climbing allowed** (`walkTop: true`): every step above.
- **Ground trips** (`walkTop: false`): the same, except **stairs → walk** is not allowed. A peasant on the wall can
  still walk along it and down a stair, but no ordinary trip goes up. This keeps the anti-goal: work and delivery
  trips never cross walls.

Every existing search (work, delivery, trees, idle stand on the ground) uses ground trips. Only the lookout search
below uses climbing.

`World` exposes `isWalkTile(tx, ty)` and `canStep(fromTx, fromTy, toTx, toTy, walkTop)`; `PathFinder.find` takes a
`canStep` rule in place of `isWalkable` (it still checks the grid bounds itself). `PeasantWalker.isNextStepBlocked`
checks the step from the peasant's tile to its next one with the mode it walked with (kept on the peasant as part of its
current path, so the checksum covers it).

`isWalkable` keeps its meaning (ground walkable) for every caller that asks about a tile, such as access tiles and
stands on the ground.

### Who climbs now: lookouts

Until soldiers exist, **idle peasants keep watch on the walls** *(my call; it is the smallest behaviour that shows the
walk working and becomes the soldiers' "post" later)*:

- When an idle peasant needs a stand, it first looks for a free walk tile (no other stand on it) that it can reach in
  climbing mode: one search toward all of them at once, so it takes the nearest by walking distance (as built: simpler
  and cheaper than a ring scan), bounded like the tree search (`treeSearchMaxExpanded`) so an unreachable wall costs
  little. Only while some stairs stand. When a wall, tower or stairs is added or removed, idle peasants on the ground
  look again, so building stairs later sends them up.
- With no such tile, it takes a ground stand around the Keep as today.
- A peasant on a wall that gets a job walks along the wall and down a stair on its way (ground-trip rules allow it).
- If its wall stand is demolished, it stands on the ground where it is and picks a new stand (existing "stand no longer
  walkable" handling, now asking about walk tiles too).
- **Stranded on the wall** (every stair down was demolished): a peasant on a walk tile whose search fails climbs down
  on the spot to its first ground-walkable edge neighbour, in the path-finder's fixed step order, as one step. It is the
  one exception to "never walk → ground" *(my call; otherwise it would be stuck for good)*. With no such neighbour it
  waits and tries again, as stranded carriers do today.
- Nobody takes a ground stand on a stair tile, as nobody takes one in a gate (it is the way up).

### Rendering

- **Stairs mesh** (`StairsShape`): stone steps on a foundation, rising from the ground side to the wall's walk height
  (`WALL_SIZES.walkHeight`), with a low side wall. Turned toward its first Wall or Tower edge neighbour in the fixed
  order north, west, east, south, decided when the mesh is made (like `gatePassage`); the ghost uses the same rule.
- **Peasant height**: a render function `walkHeight(world, tx, ty)` replaces `map.tileHeight` in `PeasantTracks`:
  - wall tile: the piece's floor height + `WALL_SIZES.walkHeight`;
  - tower tile: floor + the tower's parapet top (`TOWER_SIZES.bandTop`);
  - stairs tile: the tile's ground height (a walker on a stair is drawn rising across the step it takes onto or off
    the walk, since the height is interpolated between the two tiles);
  - else the tile height as today.
  The value between two tiles is interpolated as today.
- Peasants on a tower top stand inside its merlons; on a wall, between the merlons.

### Checksum and determinism

- The new kind is part of the object data already in the checksum. The search mode a peasant walks with is fed with its
  path. No randomness; all loops in ascending id order as today.

## Tests (the important ones)

- Placement: stairs next to a wall succeed; away from walls fail `NeedsWall`; cost 3 stone.
- Step rules: each row of the table above, both modes, including diagonal walk steps along a diagonal wall run and the
  forbidden walk → ground step.
- A delivery trip between two sides of a wall with stairs on both sides still goes through the gate (or fails without
  one); it never steps on a walk tile.
- An idle peasant with a Keep, a wall and stairs climbs and stands on a wall tile; without stairs it stands on the
  ground.
- A lookout that is given a job walks down the stair and reaches work.
- Demolishing the wall under a lookout leaves it on the ground and it takes a new stand.
- Render: the stairs mesh turns toward its wall; `walkHeight` of a wall tile is floor + 1.2.

## Left to the builder

- The stairs model's details and the icon.
- How the step rule is split into files (a `WalkRules` class beside `ObjectIndex` is likely).
- Whether the climbing flag lives on the peasant as a field or as part of its path record.
