// Every soldier and raider of a world, drawn each frame one tick behind the simulation from the peasants' body parts:
// blue tunics for the player, red for raiders, a helmet, and a spear or a bow.
import * as THREE from 'three';
import { TICKS_PER_SECOND } from '../sim/gameTime';
import { OBJECT_KINDS } from '../sim/ObjectKind';
import { hash2 } from '../sim/rng';
import { Side, UnitKind } from '../sim/UnitKind';
import type { UnitView } from '../sim/UnitView';
import type { World } from '../sim/World';
import { PeasantMeshes, UNIT_PARTS } from './PeasantMeshes';
import { PeasantPart } from './peasantParts';
import { type Pose, peasantPose } from './peasantPose';
import { PeasantRig } from './PeasantRig';
import { PeasantTracks } from './PeasantTracks';
import type { WorldLayer } from './WorldLayer';

/** Tunable values for drawing units; frozen, tune by editing the source. */
export const UNIT_RENDER_CONFIG = Object.freeze({
  initialCapacity: 64,
  /** Ticks after a strike the unit is drawn swinging. */
  strikePoseTicks: 6,
  /** Most a unit is drawn off its tile's centre, so units sharing a tile stand apart. */
  spread: 0.22,
  /** Tunic and helmet colours (sRGB) of each side. */
  tunic: Object.freeze({ [Side.Player]: 0x3d62b3, [Side.Raider]: 0xa8352f }),
  helmet: Object.freeze({ [Side.Player]: 0xa9b0b8, [Side.Raider]: 0x5a3b2a }),
});

const PHASE_SEED = 0x50d1;
const SPREAD_SEED = 0x5bead;
const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);

/** How far unit `id` is drawn off its tile's centre along x (`axis` 0) or z (1), so units on one tile stand apart. */
export function unitSpreadOffset(id: number, axis: 0 | 1): number {
  return (hash2(SPREAD_SEED, id, axis) - 0.5) * 2 * UNIT_RENDER_CONFIG.spread;
}

export class UnitLayer implements WorldLayer {
  /** Add this to the scene; holds one instanced mesh per body part (`unit-<part>`). */
  public readonly object = new THREE.Group();
  private readonly meshes = new PeasantMeshes(this.object, UNIT_RENDER_CONFIG.initialCapacity, 'unit', UNIT_PARTS);
  private readonly tracks = new PeasantTracks((world) => world.units());
  private readonly rig = new PeasantRig();
  private readonly parts = this.rig.createMatrices();
  private readonly pose: Pose = { bob: 0, lean: 0, leftLeg: 0, rightLeg: 0, leftArm: 0, rightArm: 0, tool: 0 };
  private readonly position = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly body = new THREE.Matrix4();
  private readonly tint = new THREE.Color();
  private readonly aim = new THREE.Vector2();

  /**
   * Places every unit of `world` (reading it only) one tick behind the simulation, `tickFraction` of the way between
   * its last two tick positions, posed walking, striking or standing. Call once per frame, after ticking.
   */
  public update(world: World, tickFraction: number): void {
    this.tracks.refresh(world);
    let count = 0;
    for (const _ of world.units()) count++;
    this.meshes.ensure(count);
    this.meshes.begin();
    const time = (world.tickCount + tickFraction) / TICKS_PER_SECOND;
    for (const unit of world.units()) this.draw(world, unit, tickFraction, time);
    this.meshes.end();
  }

  /** Where unit `unit` is drawn this frame (its feet), into `out`; for health bars and selection rings. */
  public placeOf(world: World, unit: UnitView, tickFraction: number, out: THREE.Vector3): THREE.Vector3 {
    this.tracks.place(world, unit, tickFraction, out);
    out.x += unitSpreadOffset(unit.id, 0);
    out.z += unitSpreadOffset(unit.id, 1);
    return out;
  }

  /** Removes the meshes and frees their buffers, the geometries and the material. Call once. */
  public dispose(): void {
    this.meshes.dispose();
    this.object.clear();
    this.tracks.clear();
  }

  private draw(world: World, unit: UnitView, tickFraction: number, time: number): void {
    let heading = this.tracks.place(world, unit, tickFraction, this.position);
    this.position.x += unitSpreadOffset(unit.id, 0);
    this.position.z += unitSpreadOffset(unit.id, 1);
    const striking = unit.lastStrikeTick >= 0 && world.tickCount - unit.lastStrikeTick < UNIT_RENDER_CONFIG.strikePoseTicks;
    const aim = striking ? this.aimAt(world, unit) : null;
    if (aim) heading = Math.atan2(aim.x - this.position.x, aim.y - this.position.z);
    const activity = striking ? 'work' : this.tracks.isMoving(unit.id) ? 'walk' : 'idle';
    const strikeTime = striking ? (world.tickCount - unit.lastStrikeTick + tickFraction) / UNIT_RENDER_CONFIG.strikePoseTicks : time;
    peasantPose({ activity, distance: this.tracks.distance(unit.id, tickFraction), time: strikeTime, phase: striking ? 0 : hash2(PHASE_SEED, unit.id, 0) }, this.pose);
    this.position.y += this.pose.bob;
    this.body.compose(this.position, this.turn.setFromAxisAngle(UP, heading), ONE);
    this.rig.pose(this.body, this.pose, this.parts);
    const m = this.meshes;
    m.push(PeasantPart.Leg, this.parts.leftLeg);
    m.push(PeasantPart.Leg, this.parts.rightLeg);
    m.push(PeasantPart.Arm, this.parts.leftArm);
    m.push(PeasantPart.Arm, this.parts.rightArm);
    m.push(PeasantPart.Torso, this.parts.torso, this.tint.set(UNIT_RENDER_CONFIG.tunic[unit.side]));
    m.push(PeasantPart.Head, this.parts.head);
    m.push(PeasantPart.Helmet, this.parts.head, this.tint.set(UNIT_RENDER_CONFIG.helmet[unit.side]));
    m.push(unit.kind === UnitKind.Archer ? PeasantPart.Bow : PeasantPart.Spear, this.parts.tool);
  }

  /** The ground point (x, z as x, y) of what `unit` strikes; null when it is gone. */
  private aimAt(world: World, unit: UnitView): THREE.Vector2 | null {
    const tile = targetTile(world, unit);
    return tile ? this.aim.set(tile.x, tile.y) : null;
  }
}

/** The centre (x, z as x, y) of what `unit` goes for: a unit's or peasant's tile, a building's footprint; else null. */
export function targetTile(world: World, unit: UnitView): { x: number; y: number } | null {
  const target = unit.target;
  if (!target) return null;
  if (target.type === 'building') {
    const object = world.objectById(target.id);
    if (!object) return null;
    const { width, height } = OBJECT_KINDS[object.kind];
    return { x: object.tx + width / 2, y: object.ty + height / 2 };
  }
  const other = target.type === 'unit' ? world.unitById(target.id) : world.peasantById(target.id);
  return other ? { x: other.tx + 0.5, y: other.ty + 0.5 } : null;
}
