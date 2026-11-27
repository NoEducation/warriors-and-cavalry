import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ArrowFlights } from '../src/render/ArrowFlights';
import { HealthBars } from '../src/render/HealthBars';
import { UNIT_RENDER_CONFIG, UnitLayer } from '../src/render/UnitLayer';
import { ObjectKind } from '../src/sim/ObjectKind';
import { Side, UnitKind } from '../src/sim/UnitKind';
import { combatWorld, place, run, runUntil } from './combatWorld';

function mesh(group: THREE.Object3D, name: string): THREE.InstancedMesh {
  const found = group.getObjectByName(name);
  if (!(found instanceof THREE.InstancedMesh)) throw new Error(`no instanced mesh ${name}`);
  return found;
}

const colorOf = (m: THREE.InstancedMesh, i: number): number => {
  const c = new THREE.Color();
  m.getColorAt(i, c);
  return c.getHex();
};

describe('UnitLayer', () => {
  it('draws each unit with a tunic of its side, a helmet, and a spear or a bow', () => {
    const world = combatWorld();
    world.spawnUnit(Side.Player, UnitKind.Spearman, 2, 2);
    world.spawnUnit(Side.Player, UnitKind.Spearman, 4, 2);
    world.spawnUnit(Side.Raider, UnitKind.Archer, 30, 30);
    const layer = new UnitLayer();
    layer.update(world, 0);
    const torso = mesh(layer.object, 'unit-torso');
    expect(torso.count).toBe(3);
    expect(mesh(layer.object, 'unit-helmet').count).toBe(3);
    expect(mesh(layer.object, 'unit-spear').count).toBe(2);
    expect(mesh(layer.object, 'unit-bow').count).toBe(1);
    const tunics = [0, 1, 2].map((i) => colorOf(torso, i));
    const blue = new THREE.Color(UNIT_RENDER_CONFIG.tunic[Side.Player]).getHex();
    const red = new THREE.Color(UNIT_RENDER_CONFIG.tunic[Side.Raider]).getHex();
    expect(tunics).toEqual([blue, blue, red]);
  });

  it('frees everything on dispose', () => {
    const world = combatWorld();
    world.spawnUnit(Side.Player, UnitKind.Spearman, 2, 2);
    const layer = new UnitLayer();
    layer.update(world, 0);
    layer.dispose();
    expect(layer.object.children).toHaveLength(0);
  });
});

describe('HealthBars', () => {
  it('shows one bar per damaged unit and damaged building, none while all are whole', () => {
    const world = combatWorld();
    const keep = place(world, ObjectKind.Keep, 10, 10);
    const units = new UnitLayer();
    const bars = new HealthBars(units);
    world.spawnUnit(Side.Player, UnitKind.Spearman, 2, 2);
    bars.update(world, 0);
    expect(mesh(bars.object, 'health-back').count).toBe(0);
    world.spawnUnit(Side.Raider, UnitKind.Archer, 15, 20); // shoots the Keep, then fights the Spearman
    runUntil(world, () => world.buildingHitPoints(keep.id)!.current < 600, 300);
    units.update(world, 0);
    bars.update(world, 0);
    expect(mesh(bars.object, 'health-back').count).toBeGreaterThanOrEqual(1);
    bars.dispose();
    expect(bars.object.children).toHaveLength(0);
  });
});

describe('ArrowFlights', () => {
  it('looses an arrow for each Archer strike and drops it once landed', () => {
    const world = combatWorld();
    place(world, ObjectKind.Keep, 10, 10);
    world.spawnUnit(Side.Raider, UnitKind.Archer, 15, 20);
    const arrows = new ArrowFlights();
    runUntil(world, () => {
      arrows.update(world, 0);
      return arrows.inFlight > 0;
    }, 300);
    expect(mesh(arrows.object, 'arrows').count).toBe(1);
    run(world, 5);
    arrows.update(world, 0);
    expect(arrows.inFlight).toBe(0);
    arrows.dispose();
  });
});
