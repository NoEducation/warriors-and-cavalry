import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FALLING_TREE_CONFIG } from '../src/render/FallingTrees';
import { StumpLayer } from '../src/render/StumpLayer';
import { TreeLayer } from '../src/render/TreeLayer';
import { TreeShadowLayer } from '../src/render/TreeShadowLayer';
import { Economy } from '../src/sim/Economy';
import { GameMap } from '../src/sim/GameMap';
import { ObjectKind } from '../src/sim/ObjectKind';
import { POPULATION_CONFIG } from '../src/sim/populationConfig';
import { resources } from '../src/sim/ResourceKind';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';
import { TICKS_PER_SECOND } from '../src/sim/gameTime';

/** A flat camp whose woodcutter fells its only tree, at (24, 7), plus a far tree at (2, 30) that stays. */
function camp(): World {
  const tiles = new Uint8Array(32 * 32).fill(TileType.Grass);
  const world = new World(new GameMap(32, 32, 1, new Float32Array(33 * 33), tiles), new Economy(resources(100, 40, 5)));
  world.spawn(ObjectKind.Tree, 24, 7);
  world.spawn(ObjectKind.Tree, 2, 30);
  for (const [kind, tx, ty] of [
    [ObjectKind.Keep, 2, 2],
    [ObjectKind.Stockpile, 10, 12],
    [ObjectKind.WoodcutterHut, 20, 6],
  ] as const) {
    if (!world.apply({ type: 'placeBuilding', kind, tx, ty }).ok) throw new Error('placement failed');
  }
  return world;
}

function tickUntilFelled(world: World): void {
  for (let n = 0; world.objectAt(24, 7)?.kind !== ObjectKind.Stump; n++) {
    if (n > 3000) throw new Error('never felled');
    world.tick();
  }
}

/** The instance of the tree at (24, 7): the one whose matrix started nearest that tile's centre. */
function instanceNear(layer: THREE.Object3D, x: number, z: number): { mesh: THREE.InstancedMesh; index: number } {
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  let best: { mesh: THREE.InstancedMesh; index: number; d: number } | null = null;
  layer.traverse((node) => {
    if (!(node instanceof THREE.InstancedMesh)) return;
    for (let i = 0; i < node.count; i++) {
      node.getMatrixAt(i, matrix);
      const d = position.setFromMatrixPosition(matrix).distanceTo(new THREE.Vector3(x, position.y, z));
      if (!best || d < best.d) best = { mesh: node, index: i, d };
    }
  });
  if (!best) throw new Error('no instance');
  return best;
}

function matrixOf({ mesh, index }: { mesh: THREE.InstancedMesh; index: number }): THREE.Matrix4 {
  return new THREE.Matrix4().fromArray(mesh.instanceMatrix.array as Float32Array, index * 16);
}

const tilt = (m: THREE.Matrix4): number => new THREE.Vector3(0, 1, 0).transformDirection(m).angleTo(new THREE.Vector3(0, 1, 0));
const scaleOf = (m: THREE.Matrix4): number => new THREE.Vector3().setFromMatrixScale(m).length();

describe('felling, as drawn', () => {
  it('tips a felled tree over and sinks it, then hides it; the other tree stays', () => {
    const world = camp();
    const layer = new TreeLayer(world);
    const slot = instanceNear(layer.object, 24.5, 7.5);
    const other = instanceNear(layer.object, 2.5, 30.5);
    const upright = tilt(matrixOf(slot));
    tickUntilFelled(world);
    layer.update(world, 0);
    expect(tilt(matrixOf(slot))).toBeCloseTo(upright);
    const half = (FALLING_TREE_CONFIG.seconds / 2) * TICKS_PER_SECOND;
    for (let i = 0; i < half; i++) world.tick();
    layer.update(world, 0);
    expect(tilt(matrixOf(slot))).toBeGreaterThan(upright + 0.1);
    for (let i = 0; i < half + 1; i++) world.tick();
    layer.update(world, 0);
    expect(scaleOf(matrixOf(slot))).toBe(0);
    expect(scaleOf(matrixOf(other))).toBeGreaterThan(0.5);
    layer.dispose();
  });

  it('removes a felled tree\'s shadow at once', () => {
    const world = camp();
    const layer = new TreeShadowLayer(world);
    const slot = instanceNear(layer.object, 24.5, 7.5);
    tickUntilFelled(world);
    layer.update();
    expect(scaleOf(matrixOf(slot))).toBe(0);
    layer.dispose();
  });

  it('draws a stump until it clears', () => {
    const world = camp();
    const layer = new StumpLayer(world);
    const stumps = (): THREE.InstancedMesh => layer.object.getObjectByName('stumps') as THREE.InstancedMesh;
    layer.update(world);
    expect(stumps().count).toBe(0);
    tickUntilFelled(world);
    layer.update(world);
    expect(stumps().count).toBe(1);
    const position = new THREE.Vector3().setFromMatrixPosition(matrixOf({ mesh: stumps(), index: 0 }));
    expect([position.x, position.z]).toEqual([24.5, 7.5]);
    for (let i = 0; i < POPULATION_CONFIG.stumpTicks; i++) world.tick();
    layer.update(world);
    expect(stumps().count).toBe(0);
    layer.dispose();
    expect(layer.object.children).toHaveLength(0);
  });

  it('stops following the world after dispose', () => {
    const world = camp();
    const layers = [new TreeLayer(world), new TreeShadowLayer(world), new StumpLayer(world)];
    for (const layer of layers) layer.dispose();
    expect(() => tickUntilFelled(world)).not.toThrow();
  });
});
