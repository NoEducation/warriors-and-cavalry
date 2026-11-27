import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SelectionController } from '../src/game/SelectionController';
import { nearestUnit, unitsInBox } from '../src/game/unitPick';
import { ObjectKind } from '../src/sim/ObjectKind';
import { Side, UnitKind } from '../src/sim/UnitKind';
import { combatWorld, place, run, runUntil } from './combatWorld';

describe('nearestUnit', () => {
  it('finds the unit of a side on or next to the tile, nearest first, and nothing farther', () => {
    const world = combatWorld();
    const a = world.spawnUnit(Side.Player, UnitKind.Spearman, 5, 5).id;
    const b = world.spawnUnit(Side.Player, UnitKind.Spearman, 6, 5).id;
    world.spawnUnit(Side.Raider, UnitKind.Spearman, 6, 6);
    expect(nearestUnit(world, { tx: 6, ty: 5 }, Side.Player)?.id).toBe(b);
    expect(nearestUnit(world, { tx: 4, ty: 4 }, Side.Player)?.id).toBe(a);
    expect(nearestUnit(world, { tx: 9, ty: 9 }, Side.Player)).toBeNull();
    expect(nearestUnit(world, { tx: 7, ty: 7 }, Side.Raider)?.side).toBe(Side.Raider);
  });
});

describe('unitsInBox', () => {
  it('keeps the points whose projection falls inside the box, whichever corner it was dragged from', () => {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 10, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const points = [
      { id: 1, at: new THREE.Vector3(0, 0, 0) },
      { id: 2, at: new THREE.Vector3(30, 0, 0) },
    ];
    expect(unitsInBox(points, camera, { x: 0.3, y: 0.3 }, { x: -0.3, y: -0.3 })).toEqual([1]);
  });
});

describe('SelectionController', () => {
  it('selects a soldier by clicking it, adds with shift, and clears on an empty click', () => {
    const world = combatWorld();
    const a = world.spawnUnit(Side.Player, UnitKind.Spearman, 5, 5).id;
    const b = world.spawnUnit(Side.Player, UnitKind.Archer, 12, 5).id;
    const selection = new SelectionController();
    expect(selection.clickAt(world, { tx: 5, ty: 5 }, false)).toBe(true);
    expect(selection.selected).toEqual([a]);
    selection.clickAt(world, { tx: 12, ty: 6 }, true);
    expect(selection.selected).toEqual([a, b]);
    expect(selection.clickAt(world, { tx: 20, ty: 20 }, false)).toBe(false);
    expect(selection.selected).toEqual([]);
  });

  it('never selects raiders, by click or by box', () => {
    const world = combatWorld();
    const r = world.spawnUnit(Side.Raider, UnitKind.Spearman, 5, 5).id;
    const selection = new SelectionController();
    selection.clickAt(world, { tx: 5, ty: 5 }, false);
    selection.select(world, [r], false);
    expect(selection.selected).toEqual([]);
  });

  it('orders an attack when right-clicking next to a raider, else a move', () => {
    const world = combatWorld();
    const a = world.spawnUnit(Side.Player, UnitKind.Spearman, 5, 5).id;
    const r = world.spawnUnit(Side.Raider, UnitKind.Spearman, 20, 20).id;
    const selection = new SelectionController();
    selection.select(world, [a], false);
    expect(selection.orderAt(world, { tx: 21, ty: 20 })).toEqual({ ok: true, ordered: 1 });
    expect(world.unitById(a)).toMatchObject({ order: 'attack', target: { type: 'unit', id: r } });
    selection.orderAt(world, { tx: 8, ty: 8 });
    expect(world.unitById(a)).toMatchObject({ order: 'move', moveTx: 8, moveTy: 8 });
    expect(new SelectionController().orderAt(world, { tx: 8, ty: 8 })).toBeNull();
  });

  it('drops dead soldiers from the selection, and everything on clear', () => {
    const world = combatWorld();
    place(world, ObjectKind.Keep, 20, 20);
    const a = world.spawnUnit(Side.Player, UnitKind.Archer, 5, 5).id;
    const b = world.spawnUnit(Side.Player, UnitKind.Spearman, 2, 2).id;
    for (let i = 0; i < 3; i++) world.spawnUnit(Side.Raider, UnitKind.Spearman, 7, 5);
    const selection = new SelectionController();
    selection.select(world, [a, b], false);
    runUntil(world, () => world.unitById(a) === undefined, 400);
    selection.prune(world);
    expect(selection.selected).not.toContain(a);
    selection.clear();
    expect(selection.selected).toEqual([]);
    run(world, 1);
  });
});
