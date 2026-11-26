// Every peasant of a world, drawn each frame one tick behind the simulation as posed body parts.
import * as THREE from 'three';
import { TICKS_PER_SECOND } from '../sim/gameTime';
import type { PeasantView } from '../sim/PeasantView';
import { ResourceKind } from '../sim/ResourceKind';
import { hash2 } from '../sim/rng';
import type { World } from '../sim/World';
import { PeasantMeshes } from './PeasantMeshes';
import { peasantLook, toolFor } from './peasantLook';
import { PeasantPart } from './peasantParts';
import { type Pose, type PoseActivity, peasantPose } from './peasantPose';
import { PeasantRig } from './PeasantRig';
import { PeasantTracks } from './PeasantTracks';
import type { WorldLayer } from './WorldLayer';

/** Tunable values for drawing peasants; frozen, tune by editing the source. */
export const PEASANT_RENDER_CONFIG = Object.freeze({
  /** Peasants the meshes have room for at first; the room doubles whenever more are needed. */
  initialCapacity: 256,
});

/** The bundle shape per carried resource. */
const BUNDLES: Record<ResourceKind, PeasantPart> = {
  [ResourceKind.Wood]: PeasantPart.LogBundle,
  [ResourceKind.Stone]: PeasantPart.StoneBundle,
  [ResourceKind.Food]: PeasantPart.SackBundle,
};
/** States in which a worker holds its tool (it is put away while carrying). */
const TOOL_STATES: ReadonlySet<PeasantView['state']> = new Set(['toWork', 'toWorkBack', 'toTree', 'chopping', 'working']);
const PHASE_SEED = 0x9a5e;
const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);

export class PeasantLayer implements WorldLayer {
  /** Add this to the scene; holds one instanced mesh per body part. */
  public readonly object = new THREE.Group();
  private readonly meshes = new PeasantMeshes(this.object, PEASANT_RENDER_CONFIG.initialCapacity);
  /** Each peasant's positions at the last two ticks, the way it last walked and how far it has walked. */
  private readonly tracks = new PeasantTracks();
  private readonly rig = new PeasantRig();
  private readonly parts = this.rig.createMatrices();
  private readonly pose: Pose = { bob: 0, lean: 0, leftLeg: 0, rightLeg: 0, leftArm: 0, rightArm: 0, tool: 0 };
  private readonly position = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly body = new THREE.Matrix4();
  private readonly tint = new THREE.Color();

  /**
   * Places every peasant of `world` (reading it only) one tick behind the simulation, `tickFraction` of the way from
   * where it stood at the previous tick to where it stands at the last one, posed for what it is doing: walking,
   * carrying its load, working with its tool or standing idle. Call once per frame, after ticking. Allocates only
   * when the peasants outgrow the meshes or new ones arrive.
   */
  public update(world: World, tickFraction: number): void {
    this.tracks.refresh(world);
    let count = 0;
    for (const _ of world.peasants()) count++;
    this.meshes.ensure(count);
    this.meshes.begin();
    const time = (world.tickCount + tickFraction) / TICKS_PER_SECOND;
    for (const peasant of world.peasants()) this.draw(world, peasant, tickFraction, time);
    this.meshes.end();
  }

  /** Removes the meshes and frees their buffers, the geometries and the material. Call once. */
  public dispose(): void {
    this.meshes.dispose();
    this.object.clear();
    this.tracks.clear();
  }

  private draw(world: World, peasant: PeasantView, tickFraction: number, time: number): void {
    let heading = this.tracks.place(world.map, peasant, tickFraction, this.position);
    const tree = peasant.state === 'chopping' && peasant.treeId !== null ? world.objectById(peasant.treeId) : undefined;
    if (tree) heading = Math.atan2(tree.tx + 0.5 - this.position.x, tree.ty + 0.5 - this.position.z);
    peasantPose(
      {
        activity: this.activity(peasant),
        distance: this.tracks.distance(peasant.id, tickFraction),
        time,
        phase: hash2(PHASE_SEED, peasant.id, 0),
      },
      this.pose,
    );
    this.position.y += this.pose.bob;
    this.body.compose(this.position, this.turn.setFromAxisAngle(UP, heading), ONE);
    this.rig.pose(this.body, this.pose, this.parts);
    const look = peasantLook(peasant.id);
    const m = this.meshes;
    m.push(PeasantPart.Leg, this.parts.leftLeg);
    m.push(PeasantPart.Leg, this.parts.rightLeg);
    m.push(PeasantPart.Arm, this.parts.leftArm);
    m.push(PeasantPart.Arm, this.parts.rightArm);
    m.push(PeasantPart.Torso, this.parts.torso, this.tint.set(look.tunic));
    m.push(PeasantPart.Head, this.parts.head);
    m.push(look.headwear === 'hat' ? PeasantPart.Hat : PeasantPart.Hood, this.parts.head, this.tint.set(look.headwearColor));
    if (peasant.load) m.push(BUNDLES[peasant.load.resource], this.parts.bundle);
    const workplace = peasant.workplaceId === null ? undefined : world.objectById(peasant.workplaceId);
    const tool = TOOL_STATES.has(peasant.state) && !peasant.load ? toolFor(workplace?.kind) : null;
    if (tool !== null) m.push(tool, this.parts.tool);
  }

  /** Carrying when it has a load, walking when it moved since the last tick, working at work, else idle. */
  private activity(peasant: PeasantView): PoseActivity {
    if (peasant.load) return 'carry';
    if (this.tracks.isMoving(peasant.id)) return 'walk';
    if (peasant.state === 'chopping' || (peasant.state === 'working' && peasant.waitTicks === 0)) return 'work';
    return 'idle';
  }
}
