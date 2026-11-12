import { describe, expect, it } from 'vitest';
import { BuildController } from '../src/game/BuildController';
import { BUILD_TOOLS, type BuildTool } from '../src/game/BuildTool';
import { GameMap } from '../src/sim/GameMap';
import { ObjectKind } from '../src/sim/ObjectKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';

const SIZE = 16;
const HOVEL: BuildTool = { type: 'build', kind: ObjectKind.Hovel };
const KEEP: BuildTool = { type: 'build', kind: ObjectKind.Keep };
const DEMOLISH: BuildTool = { type: 'demolish' };

function flatWorld(): World {
  const heights = new Float32Array((SIZE + 1) * (SIZE + 1));
  const tiles = new Uint8Array(SIZE * SIZE).fill(TileType.Grass);
  return new World(new GameMap(SIZE, SIZE, 1, heights, tiles));
}

function setup(world: World = flatWorld()): { world: World; controller: BuildController; messages: string[] } {
  const messages: string[] = [];
  const controller = new BuildController(world, (text) => messages.push(text));
  return { world, controller, messages };
}

describe('BUILD_TOOLS', () => {
  it('lists Keep, Hovel, Woodcutter and Demolish on digit keys 1-4', () => {
    expect(BUILD_TOOLS.map((e) => [e.label, e.key])).toEqual([
      ['Keep', 'Digit1'],
      ['Hovel', 'Digit2'],
      ['Woodcutter', 'Digit3'],
      ['Demolish', 'Digit4'],
    ]);
    expect(BUILD_TOOLS[2].tool).toEqual({ type: 'build', kind: ObjectKind.WoodcutterHut });
    expect(BUILD_TOOLS[3].tool).toEqual(DEMOLISH);
  });
});

describe('BuildController', () => {
  it('does nothing without a tool', () => {
    const { world, controller, messages } = setup();
    expect(controller.tool).toBeNull();
    expect(controller.preview({ tx: 1, ty: 1 })).toBeNull();
    expect(controller.click({ tx: 1, ty: 1 })).toBeNull();
    expect(world.objectCount).toBe(0);
    expect(messages).toEqual([]);
  });

  it('previews and places a Hovel, keeping the tool', () => {
    const { world, controller, messages } = setup();
    world.spawn(ObjectKind.Tree, 8, 8);
    controller.selectTool(HOVEL);
    expect(controller.preview({ tx: 2, ty: 2 })).toEqual({ kind: ObjectKind.Hovel, tx: 2, ty: 2, ok: true });
    expect(controller.preview({ tx: 7, ty: 7 })).toEqual({ kind: ObjectKind.Hovel, tx: 7, ty: 7, ok: false });
    const result = controller.click({ tx: 2, ty: 2 });
    expect(result?.ok).toBe(true);
    expect(world.objectAt(2, 2)?.kind).toBe(ObjectKind.Hovel);
    expect(controller.tool).toEqual(HOVEL);
    expect(messages).toEqual([]);
  });

  it('ignores a click with no tile', () => {
    const { world, controller, messages } = setup();
    controller.selectTool(HOVEL);
    expect(controller.click(null)).toBeNull();
    expect(controller.preview(null)).toBeNull();
    expect(world.objectCount).toBe(0);
    expect(messages).toEqual([]);
  });

  it('reports a rejected placement', () => {
    const { world, controller, messages } = setup();
    controller.selectTool(HOVEL);
    controller.click({ tx: 2, ty: 2 });
    const result = controller.click({ tx: 3, ty: 3 });
    expect(result).toEqual({ ok: false, reason: 'Occupied' });
    expect(messages).toEqual(['Cannot build: occupied']);
    expect(world.objectCount).toBe(1);
  });

  it('rejects a Keep over the map edge without throwing', () => {
    const { world, controller, messages } = setup();
    controller.selectTool(KEEP);
    expect(controller.preview({ tx: SIZE - 2, ty: SIZE - 2 })?.ok).toBe(false);
    expect(() => controller.click({ tx: SIZE - 2, ty: SIZE - 2 })).not.toThrow();
    expect(messages).toEqual(['Cannot build: out of bounds']);
    expect(world.objectCount).toBe(0);
  });

  it('demolishes buildings but not trees or empty tiles', () => {
    const { world, controller, messages } = setup();
    world.spawn(ObjectKind.Tree, 8, 8);
    world.apply({ type: 'placeBuilding', kind: ObjectKind.Hovel, tx: 2, ty: 2 });
    controller.selectTool(DEMOLISH);
    expect(controller.preview({ tx: 2, ty: 2 })).toBeNull();
    expect(controller.click({ tx: 3, ty: 3 })?.ok).toBe(true);
    expect(world.objectAt(2, 2)).toBeUndefined();
    expect(controller.click({ tx: 8, ty: 8 })).toEqual({ ok: false, reason: 'NotDemolishable' });
    expect(controller.click({ tx: 0, ty: 0 })).toEqual({ ok: false, reason: 'UnknownObject' });
    expect(messages).toEqual(['Cannot demolish: trees cannot be removed', 'Cannot demolish: nothing here']);
    expect(world.objectCount).toBe(1);
  });

  it('cancel clears the tool', () => {
    const { controller } = setup();
    controller.selectTool(HOVEL);
    controller.cancel();
    expect(controller.tool).toBeNull();
  });

  it('setWorld keeps the tool and places into the new world', () => {
    const { world: oldWorld, controller } = setup();
    controller.selectTool(HOVEL);
    controller.click({ tx: 1, ty: 1 });
    const newWorld = flatWorld();
    controller.setWorld(newWorld);
    expect(controller.tool).toEqual(HOVEL);
    expect(controller.click({ tx: 5, ty: 5 })?.ok).toBe(true);
    expect(newWorld.objectAt(5, 5)?.kind).toBe(ObjectKind.Hovel);
    expect(oldWorld.objectCount).toBe(1);
  });
});
