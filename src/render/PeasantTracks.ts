// Where each peasant stood at the last two simulation ticks, so it can be drawn one tick behind and move every frame.
import * as THREE from 'three';
import type { GameMap } from '../sim/GameMap';
import type { PeasantView } from '../sim/Peasant';
import type { World } from '../sim/World';

/** One peasant's positions at the previous and the latest tick, and the way it last walked. */
interface Track {
  readonly previous: THREE.Vector3;
  readonly current: THREE.Vector3;
  /** Yaw about +y, 0 facing +z. */
  heading: number;
  /** The tick it was last seen in; a track not seen in the latest tick belongs to a peasant who has left. */
  seenTick: number;
}

export class PeasantTracks {
  private readonly tracks = new Map<number, Track>();
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
    for (const peasant of world.peasants()) {
      const track = this.tracks.get(peasant.id);
      if (!track) {
        this.start(world.map, peasant);
        continue;
      }
      track.previous.copy(track.current);
      tickPosition(world.map, peasant, track.current);
      track.seenTick = this.tick;
      const dx = track.current.x - track.previous.x;
      const dz = track.current.z - track.previous.z;
      if (dx !== 0 || dz !== 0) track.heading = Math.atan2(dx, dz);
    }
    for (const [id, track] of this.tracks) if (track.seenTick !== this.tick) this.tracks.delete(id);
  }

  /**
   * Sets `out` to where `peasant` is drawn `tickFraction` of the way from its previous to its latest tick position,
   * and returns its heading. A peasant `refresh` has not seen yet is drawn where it stands now.
   */
  public place(map: GameMap, peasant: PeasantView, tickFraction: number, out: THREE.Vector3): number {
    const track = this.tracks.get(peasant.id) ?? this.start(map, peasant);
    out.lerpVectors(track.previous, track.current, tickFraction);
    return track.heading;
  }

  /** Forgets every peasant. */
  public clear(): void {
    this.tracks.clear();
  }

  /** A new track for `peasant` that starts (and stays, until the next tick) where it stands now. */
  private start(map: GameMap, peasant: PeasantView): Track {
    const current = tickPosition(map, peasant, new THREE.Vector3());
    const heading = peasant.stepTicks > 0 ? Math.atan2(peasant.nextTx - peasant.tx, peasant.nextTy - peasant.ty) : 0;
    const track: Track = { previous: current.clone(), current, heading, seenTick: this.tick };
    this.tracks.set(peasant.id, track);
    return track;
  }
}

/** Sets `out` to where `peasant` stands at the end of the latest tick: its tile centre moved along its step. */
function tickPosition(map: GameMap, peasant: PeasantView, out: THREE.Vector3): THREE.Vector3 {
  const { tx, ty, nextTx, nextTy, stepTicks } = peasant;
  const t = stepTicks > 0 ? peasant.stepProgress / stepTicks : 0;
  const height = map.tileHeight(tx, ty) + (map.tileHeight(nextTx, nextTy) - map.tileHeight(tx, ty)) * t;
  return out.set(tx + 0.5 + (nextTx - tx) * t, height, ty + 0.5 + (nextTy - ty) * t);
}
