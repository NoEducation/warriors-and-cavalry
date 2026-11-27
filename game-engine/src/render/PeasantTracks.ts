// Where each walker (peasant or unit) stood at the last two simulation ticks, so it can be drawn one tick behind and move every frame.
import * as THREE from 'three';
import type { WalkerView } from '../sim/Walker';
import type { World } from '../sim/World';
import { walkHeight } from './walkHeight';

/** One peasant's positions at the previous and the latest tick, and the way it last walked. */
interface Track {
  readonly previous: THREE.Vector3;
  readonly current: THREE.Vector3;
  /** Yaw about +y, 0 facing +z. */
  heading: number;
  /** Tiles walked up to the previous and the latest tick, which drive the steps of the walk. */
  previousDistance: number;
  distance: number;
  /** The tick it was last seen in; a track not seen in the latest tick belongs to a peasant who has left. */
  seenTick: number;
}

/** The walkers a set of tracks follows in `world`, in ascending id order. */
export type WalkerSource = (world: World) => Iterable<WalkerView>;

export class PeasantTracks {
  private readonly tracks = new Map<number, Track>();

  /** Tracks the walkers `source` lists (by default the world's peasants). */
  public constructor(private readonly source: WalkerSource = (world) => world.peasants()) {}

  /** The world tick the current positions were recorded at; -1 before the first refresh. */
  private tick = -1;

  /**
   * When `world` has ticked since the last call, makes each peasant's current position its previous one and records
   * where it stands now; forgets peasants who have left. Call once per frame, before `place`. Allocates only for
   * peasants seen for the first time.
   */
  public refresh(world: World): void {
    if (world.tickCount === this.tick) return;
    this.tick = world.tickCount;
    for (const peasant of this.source(world)) {
      const track = this.tracks.get(peasant.id);
      if (!track) {
        this.start(world, peasant);
        continue;
      }
      track.previous.copy(track.current);
      tickPosition(world, peasant, track.current);
      track.seenTick = this.tick;
      const dx = track.current.x - track.previous.x;
      const dz = track.current.z - track.previous.z;
      track.previousDistance = track.distance;
      track.distance += Math.sqrt(dx * dx + dz * dz);
      if (dx !== 0 || dz !== 0) track.heading = Math.atan2(dx, dz);
    }
    for (const [id, track] of this.tracks) if (track.seenTick !== this.tick) this.tracks.delete(id);
  }

  /**
   * Sets `out` to where `peasant` is drawn `tickFraction` of the way from its previous to its latest tick position,
   * and returns its heading. A peasant `refresh` has not seen yet is drawn where it stands now.
   */
  public place(world: World, peasant: WalkerView, tickFraction: number, out: THREE.Vector3): number {
    const track = this.tracks.get(peasant.id) ?? this.start(world, peasant);
    out.lerpVectors(track.previous, track.current, tickFraction);
    return track.heading;
  }

  /** Tiles peasant `id` has walked, `tickFraction` of the way from the previous tick to the latest; 0 if unknown. */
  public distance(id: number, tickFraction: number): number {
    const track = this.tracks.get(id);
    return track ? track.previousDistance + (track.distance - track.previousDistance) * tickFraction : 0;
  }

  /** True when peasant `id` moved between the previous and the latest tick. */
  public isMoving(id: number): boolean {
    const track = this.tracks.get(id);
    return track !== undefined && track.distance !== track.previousDistance;
  }

  /** Forgets every peasant. */
  public clear(): void {
    this.tracks.clear();
  }

  /** A new track for `peasant` that starts (and stays, until the next tick) where it stands now. */
  private start(world: World, peasant: WalkerView): Track {
    const current = tickPosition(world, peasant, new THREE.Vector3());
    const heading = peasant.stepTicks > 0 ? Math.atan2(peasant.nextTx - peasant.tx, peasant.nextTy - peasant.ty) : 0;
    const track: Track = { previous: current.clone(), current, heading, previousDistance: 0, distance: 0, seenTick: this.tick };
    this.tracks.set(peasant.id, track);
    return track;
  }
}

/**
 * Sets `out` to where `peasant` stands at the end of the latest tick: its tile centre moved along its step, at the
 * walk height of the tiles it steps between (up on the wall walk on walls and towers).
 */
function tickPosition(world: World, peasant: WalkerView, out: THREE.Vector3): THREE.Vector3 {
  const { tx, ty, nextTx, nextTy, stepTicks } = peasant;
  const t = stepTicks > 0 ? peasant.stepProgress / stepTicks : 0;
  const from = walkHeight(world, tx, ty);
  const height = from + (walkHeight(world, nextTx, nextTy) - from) * t;
  return out.set(tx + 0.5 + (nextTx - tx) * t, height, ty + 0.5 + (nextTy - ty) * t);
}
