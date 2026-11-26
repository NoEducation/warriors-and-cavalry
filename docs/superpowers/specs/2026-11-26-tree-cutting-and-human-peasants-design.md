# Tree Cutting and Human-Looking Peasants

Date: 2026-11-26
Status: draft, awaiting owner approval
Builds on: `2026-11-25-peasants-design.md`, `2026-11-26-walls-design.md` and
`AGENTS.md` (all of their rules still apply unless this document changes them).

## Intent

Two changes the owner asked for together.

1. **Tree cutting.** Woodcutters really fell trees, so wood is finite and
   forests shrink. Where the player puts a woodcutter's hut starts to matter:
   once the trees in reach are gone, the hut stops and a new one must be built
   closer to the forest. Today a hut only checks that some tree stands within
   8 tiles and produces forever.
2. **Peasants that look like people.** Today a peasant is four stacked boxes
   that glide between tiles. They should have a shaped body with arms, hands,
   face and hair, vary a little in clothing, and move: legs and arms swing as
   they walk, workers swing their tool, carriers stoop under their load. The
   woodcutter swinging an axe at a tree is the moment that ties both halves
   together.

## Goals

- A woodcutter walks from its hut to the nearest free tree in range, chops it
  for one production cycle, the tree falls and leaves a stump, and the worker
  carries the wood to storage and returns to the hut.
- A felled tree is gone for good (owner's choice A: no regrowth, no replanting).
  The stump clears by itself after a while.
- A hut with no free tree left in range shows `noTrees` and its worker waits
  at the hut.
- Peasants are drawn as low-poly people: head with face and hair, hat or hood,
  tapered tunic with belt, two arms with hands, two legs with shoes.
- Per-peasant variety: tunic and headwear colour chosen from small palettes by
  peasant id.
- Animation: a walk cycle (legs and arms swing, slight bob); a work swing for
  the woodcutter (axe), the quarry worker (pick) and the farmer (hoe), each
  holding their tool; carriers lean forward with the load on their back and
  arms holding it; idle peasants stand with a slow breathing sway.
- A felled tree visibly tips over and sinks away before the stump shows
  (render only).

## Non-goals (later stages)

Forest regrowth, saplings, replanting, sawmills or planks, more than one log
per tree, a tree count or wood estimate in the UI, peasants avoiding each
other, skeletal animation, faces with expressions, gender or age variants,
sound.

## Anti-goals

- A simulation that depends on render state, or animation that changes what
  the simulation does. Animation is derived purely from what a `PeasantView`
  already says plus render time.
- Two woodcutters chopping the same tree, or a woodcutter walking to a tree
  that was felled or built over while it walked.
- A frame-rate drop: all peasants together stay a fixed, small number of draw
  calls no matter how many peasants there are.
- A hut that silently stops: the player must be able to see why (`noTrees`).

## Approaches considered

### Felling trees

- **A. Hut → tree → storage → hut (chosen).** The worker picks a tree, walks to
  it, chops for the production cycle, carries the batch straight to storage
  with the existing delivery trip, then walks back to the hut. Reuses
  `WorkerTrips` delivery; the hut stays the anchor for the tree radius.
- **B. Remote felling.** The worker stays at the hut and each finished cycle
  removes the nearest tree. Rejected: nothing to watch, which is half the
  point.
- **C. Logs back to the hut first.** Tree → hut (saw) → storage. Rejected:
  doubles the walking and is really a sawmill feature.

### Animating peasants

- **A. One instanced mesh per body part, posed on the CPU (chosen).** Head,
  torso, each arm, each leg, the bundle and each tool kind get their own
  `InstancedMesh`; a pure pose function turns a peasant's state and timing into
  joint angles, and each part's instance matrix is the body matrix times the
  part's joint transform. About ten draw calls in total, fits the current
  `PeasantLayer`, and the pose maths is unit-testable.
- **B. One mesh with a bone index per vertex and a custom vertex shader.** One
  draw call, but patching `MeshLambertMaterial` shaders is fiddly and hard to
  test. Rejected.
- **C. A three.js `SkinnedMesh` per peasant.** One draw call per peasant.
  Rejected on cost.

## Design (decided)

### Simulation

**New peasant states.** `PEASANT_STATES` gains `toTree` and `chopping`
(appended, so existing state indices keep their checksum values). A woodcutter
goes:

`toWork` (to hut) → at hut: pick tree → `toTree` → on arrival `chopping` →
cycle done: tree felled, `toStore` → `toWorkBack` (to hut) → pick tree → …

If no free tree is in range when the worker stands at its hut, it becomes
`working` at the hut and the hut reports `noTrees`; it tries to pick a tree
again after `retryTicks` (plus the per-id spread), so a hut without trees does
not search a path every tick. *(Builder call.)*

**Production for woodcutters.** Production advances for a woodcutter only
while its worker is `chopping` (for other kinds, `working` as now). `noTrees`
now means "no tree in range that is not claimed by another woodcutter".

**Picking a tree.** Candidates are tree objects within the hut's `treeRadius`
(Chebyshev distance from the footprint, as today) that no other woodcutter has
claimed. The worker runs one multi-goal path search from where it stands to
the walkable neighbour tiles (edge neighbours) of every candidate; the tree
whose neighbour the path ends on is claimed. Ties are already broken by the
path finder deterministically. A tree with no reachable neighbour is not
picked; if no candidate is reachable the job is given up as today
(`workerCannotReach`, the hut is skipped for a while).

**Claims.** A new sim class `TreeClaims` maps tree id → woodcutter peasant id.
A claim is released when the tree is felled, when the worker goes idle or
leaves, or when the tree is removed any other way (built over cannot happen,
trees block placement, but the rule covers it).

**Re-routing.** While `toTree`, if the claimed tree is gone or the next step is
blocked, the worker picks again (releasing its claim first).

**Felling.** When the chopping cycle finishes: the tree is removed and a
`Stump` object is spawned on its tile in the same tick, then the batch goes to
the worker exactly as `collect` does today. This happens inside `World.tick`,
so it is deterministic and in ascending id order.

**Stump.** New `ObjectKind.Stump`: 1 × 1, not buildable by the player, blocks
placement, walkable like a tree. A new sim class `Stumps` counts each stump down
from `stumpTicks` (config, 600 ticks = 1 minute) and removes it when it reaches
0, in ascending id order. Stumps are part of the checksum through the object
list as all objects are.

**Facing.** `PeasantView` gains `choppingTx` / `choppingTy` (the claimed
tree's tile, or -1 when none) so render can face a chopping worker at its
tree. The checksum covers them.

**Config.** `POPULATION_CONFIG` gains `stumpTicks`. The woodcutter's
`cycleTicks` (100) and `yield` (2) stay; one tree gives one batch.

**Files.** New: `TreeClaims.ts`, `Stumps.ts`, `WoodcutterTrips.ts` (the
tree-picking and chopping part of a woodcutter's trip, so `WorkerTrips` stays
under 150 lines). Changed: `PeasantView`, `Peasant` (transitions
`headToTree`, `startChopping`), `Production` (status by claims, advance while
chopping), `Population`, `ObjectKind`, `ObjectIndex.isWalkable`,
`ObjectLifecycle`, `worldChecksum`.

### Rendering

**Figure.** `PeasantGeometryFactory` builds one geometry per part, each with its
pivot at the joint (hip for legs, shoulder for arms, neck for head, waist for
torso). Shapes are tapered boxes and simple prisms in vertex colours, about
0.8 tall as now:

- legs: hose with a darker shoe at the bottom;
- torso: tunic wider at the hem than the shoulders, belt band, short skirt of
  the tunic over the hips;
- arms: sleeve and a skin-coloured hand;
- head: skin, a two-pixel darker band for eyes, hair at the back and sides;
- headwear: straw hat (brim + crown) or a hood, chosen by id;
- tools: axe, pick, hoe, each a handle with a head, held in the right hand;
- bundle: shaped per resource — a bundle of logs (wood), a block in a sling
  (stone), a sack (food).

**Variety.** Tunic colour from a palette of 5 muted colours, headwear colour
from 3, chosen by `hash(id)`; applied with per-instance colours on the torso
and headwear meshes (the geometry's vertex colours are white there, so the
instance colour shows through, as trees do with their tint).

**Poses.** A pure function `peasantPose(input): Pose` in `peasantPose.ts`:
input is the state, whether it is moving, step progress as a fraction, a
per-peasant phase offset (from id) and render time in seconds; output is the
torso lean, body bob, and the swing angle of each arm and leg and the tool.

- walking: legs ±30°, arms ∓25° opposite, bob 0.02, at about two strides per
  tile, driven by distance walked so feet do not slide;
- carrying (`toStore`): walking pose with torso lean 15° and both arms raised
  back to hold the load, smaller arm swing;
- working (`working` at quarry or farm, `chopping`): tool arm raises to 120°
  and strikes down in a 1-second cycle, the other arm follows, torso dips on
  the strike;
- idle and woodcutter waiting at hut: arms at the sides, slow sway of ±2° on a
  4-second cycle.

The phase offset keeps peasants from moving in lockstep.

**Tool per worker.** Chosen from the worker's workplace kind (read via
`objectById` on the world): woodcutter → axe, quarry → pick, farm → hoe. A tool
is shown while working or walking to and from work, hidden while carrying.

**Facing.** Walking peasants face their direction as now (`PeasantTracks`); a
chopping peasant faces its tree tile.

**Falling tree.** When a tree is removed and a stump appears on the same tile in
the same change batch, `TreeLayer` keeps the tree's instance for 1.5 s, rotating
it about its base away from the chopper and sinking it into the ground, then
drops it. A stump is a short trunk cylinder with a lighter top, drawn by a new
`StumpLayer` (one instanced mesh).

**Draw calls.** Legs (×2 instances per peasant in one mesh), arms (same), torso,
head, headwear (hat and hood: two meshes), bundles (three shapes: three
meshes), tools (three meshes), stumps: about 13 draw calls in total, constant in
the number of peasants. Empty meshes are hidden as now.

**Files.** New: `peasantPose.ts`, `PeasantParts.ts` (part geometries and joint
offsets), `StumpLayer.ts`, `FallingTrees.ts`. Changed:
`PeasantGeometryFactory`, `PeasantLayer` (split if it passes 150 lines),
`TreeLayer`, `WorldView`.

### Tests (test-first for sim and pure maths)

- A woodcutter walks to a tree, chops, the tree becomes a stump, wood arrives
  in storage, and the worker returns to the hut.
- Two woodcutters next to one tree: only one claims it.
- A hut whose trees are all felled shows `noTrees` and its worker stands at
  the hut.
- The claimed tree disappearing mid-walk makes the worker pick another.
- A stump disappears after `stumpTicks` and the tile is buildable again.
- Two worlds from one seed with the same commands have the same checksum after
  many ticks of woodcutting.
- `peasantPose`: walking legs swing opposite each other; poses are periodic;
  idle arms hang; the strike angle range for working.
- Part geometries are built in Node with the expected pivot (joint at origin).

## Left to the builder

- Exact shapes, colours and palette values, within the look described.
- Exact animation timings, within the ranges above.
- How `PeasantLayer` is split between files.
- Whether the tool choice is cached per peasant or looked up each frame.
