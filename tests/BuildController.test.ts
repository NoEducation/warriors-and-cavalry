import { describe, expect, it } from 'vitest';
import { BuildController } from '../src/game/BuildController';
import { BUILD_TOOLS, type BuildTool } from '../src/ui/BuildTool';
import { Economy } from '../src/sim/Economy';
import { GameMap } from '../src/sim/GameMap';
import { ObjectKind } from '../src/sim/ObjectKind';
import { type ResourceAmounts, ResourceKind, resources } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';

const SIZE = 16;
const HOVEL: BuildTool = { type: 'build', kind: ObjectKind.Hovel };
const KEEP: BuildTool = { type: 'build', kind: ObjectKind.Keep };
const QUARRY: BuildTool = { type: 'build', kind: ObjectKind.Quarry };
const DEMOLISH: BuildTool = { type: 'demolish' };

/** A flat all-grass world; `start` gives the economy's start amounts (default: the normal ones). */
function flatWorld(start?: ResourceAmounts): World {
  const heights = new Float32Array((SIZE + 1) * (SIZE + 1));
  const tiles = new Uint8Array(SIZE * SIZE).fill(TileType.Grass);
  return new World(new GameMap(SIZE, SIZE, 1, heights, tiles), start ? new Economy(start) : undefined);
}

function setup(world: World = flatWorld()): { world: World; controller: BuildController; messages: string[] } {
  const messages: string[] = [];
  const controller = new BuildController((text) => messages.push(text));
  return { world, controller, messages };
}

describe('BUILD_TOOLS', () => {
  it('lists seven buildings and Demolish on digit keys 1-8', () => {
    expect(BUILD_TOOLS.map((e) => [e.label, e.key])).toEqual([
      ['Keep', 'Digit1'],
      ['Hovel', 'Digit2'],
      ['Woodcutter', 'Digit3'],
      ['Stockpile', 'Digit4'],
      ['Granary', 'Digit5'],
      ['Quarry', 'Digit6'],
      ['Farm', 'Digit7'],
      ['Demolish', 'Digit8'],
    ]);
    expect(BUILD_TOOLS.slice(0, 7).map((e) => e.tool)).toEqual(
      [
        ObjectKind.Keep,
        ObjectKind.Hovel,
        ObjectKind.WoodcutterHut,
        ObjectKind.Stockpile,
        ObjectKind.Granary,
        ObjectKind.Quarry,
        ObjectKind.WheatFarm,
      ].map((kind) => ({ type: 'build', kind })),
    );
    expect(BUILD_TOOLS[7].tool).toEqual(DEMOLISH);
  });
});

describe('BuildController', () => {
  it('does nothing without a tool', () => {
    const { world, controller, messages } = setup();
    expect(controller.tool).toBeNull();
    expect(controller.preview(world, { tx: 1, ty: 1 })).toBeNull();
    expect(controller.click(world, { tx: 1, ty: 1 })).toBeNull();
    expect(world.objectCount).toBe(0);
    expect(messages).toEqual([]);
  });

  it('previews and places a Hovel, keeping the tool', () => {
    const { world, controller, messages } = setup();
    world.spawn(ObjectKind.Tree, 8, 8);
    controller.selectTool(HOVEL);
    expect(controller.preview(world, { tx: 2, ty: 2 })).toEqual({ kind: ObjectKind.Hovel, tx: 2, ty: 2, ok: true });
    expect(controller.preview(world, { tx: 7, ty: 7 })).toEqual({ kind: ObjectKind.Hovel, tx: 7, ty: 7, ok: false });
    const result = controller.click(world, { tx: 2, ty: 2 });
    expect(result?.ok).toBe(true);
    expect(world.objectAt(2, 2)?.kind).toBe(ObjectKind.Hovel);
    expect(controller.tool).toEqual(HOVEL);
    expect(messages).toEqual([]);
  });

  it('ignores a click with no tile', () => {
    const { world, controller, messages } = setup();
    controller.selectTool(HOVEL);
    expect(controller.click(world, null)).toBeNull();
    expect(controller.preview(world, null)).toBeNull();
    expect(world.objectCount).toBe(0);
    expect(messages).toEqual([]);
  });

  it('reports a rejected placement', () => {
    const { world, controller, messages } = setup();
    controller.selectTool(HOVEL);
    controller.click(world, { tx: 2, ty: 2 });
    const result = controller.click(world, { tx: 3, ty: 3 });
    expect(result).toEqual({ ok: false, reason: 'Occupied' });
    expect(messages).toEqual(['Cannot build: occupied']);
    expect(world.objectCount).toBe(1);
  });

  it('rejects a Keep over the map edge without throwing', () => {
    const { world, controller, messages } = setup();
    controller.selectTool(KEEP);
    expect(controller.preview(world, { tx: SIZE - 2, ty: SIZE - 2 })?.ok).toBe(false);
    expect(() => controller.click(world, { tx: SIZE - 2, ty: SIZE - 2 })).not.toThrow();
    expect(messages).toEqual(['Cannot build: out of bounds']);
    expect(world.objectCount).toBe(0);
  });

  it('demolishes buildings but not trees or empty tiles', () => {
    const { world, controller, messages } = setup();
    world.spawn(ObjectKind.Tree, 8, 8);
    world.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 2, ty: 2 });
    controller.selectTool(DEMOLISH);
    expect(controller.preview(world, { tx: 2, ty: 2 })).toBeNull();
    expect(controller.click(world, { tx: 3, ty: 3 })?.ok).toBe(true);
    expect(world.objectAt(2, 2)).toBeUndefined();
    expect(controller.click(world, { tx: 8, ty: 8 })).toEqual({ ok: false, reason: 'NotDemolishable' });
    expect(controller.click(world, { tx: 0, ty: 0 })).toEqual({ ok: false, reason: 'UnknownObject' });
    expect(messages).toEqual(['Cannot demolish: trees cannot be removed', 'Cannot demolish: nothing here']);
    expect(world.objectCount).toBe(1);
  });

  it('selecting null deselects the tool', () => {
    const { world, controller } = setup();
    controller.selectTool(HOVEL);
    controller.selectTool(null);
    expect(controller.tool).toBeNull();
    expect(controller.preview(world, { tx: 1, ty: 1 })).toBeNull();
  });

  it('places into the world passed with each click', () => {
    const { world: worldA, controller } = setup();
    controller.selectTool(HOVEL);
    expect(controller.click(worldA, { tx: 1, ty: 1 })?.ok).toBe(true);
    const worldB = flatWorld();
    expect(controller.click(worldB, { tx: 5, ty: 5 })?.ok).toBe(true);
    expect(worldB.objectAt(5, 5)?.kind).toBe(ObjectKind.Hovel);
    expect(worldA.objectCount).toBe(1);
    expect(worldA.objectAt(5, 5)).toBeUndefined();
  });

  it('previews red and rejects a building the player cannot pay for', () => {
    const { world, controller, messages } = setup(flatWorld(resources(10, 0, 0)));
    controller.selectTool(HOVEL);
    expect(controller.preview(world, { tx: 2, ty: 2 })).toEqual({ kind: ObjectKind.Hovel, tx: 2, ty: 2, ok: false });
    expect(controller.click(world, { tx: 2, ty: 2 })).toEqual({ ok: false, reason: 'NotEnoughResources' });
    expect(messages).toEqual(['Cannot build: not enough wood']);
    expect(world.objectCount).toBe(0);
    expect(world.economy.amount(ResourceKind.Wood)).toBe(10);
  });

  it('names the resource that falls short', () => {
    const { world, controller, messages } = setup(flatWorld(resources(100, 0, 0)));
    controller.selectTool(KEEP);
    controller.click(world, { tx: 2, ty: 2 });
    expect(messages).toEqual(['Cannot build: not enough stone']);
  });

  it('rejects a Quarry away from rock', () => {
    const { world, controller, messages } = setup();
    controller.selectTool(QUARRY);
    expect(controller.preview(world, { tx: 2, ty: 2 })?.ok).toBe(false);
    expect(controller.click(world, { tx: 2, ty: 2 })).toEqual({ ok: false, reason: 'NeedsRock' });
    expect(messages).toEqual(['Cannot build: needs rock nearby']);
  });

  it('places and pays when the cost can be covered', () => {
    const { world, controller, messages } = setup(flatWorld(resources(100, 40, 0)));
    controller.selectTool(KEEP);
    expect(controller.preview(world, { tx: 2, ty: 2 })?.ok).toBe(true);
    expect(controller.click(world, { tx: 2, ty: 2 })?.ok).toBe(true);
    expect(world.economy.amount(ResourceKind.Wood)).toBe(50);
    expect(world.economy.amount(ResourceKind.Stone)).toBe(0);
    expect(messages).toEqual([]);
  });
});
