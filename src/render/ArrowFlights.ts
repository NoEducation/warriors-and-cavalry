// Arrows: each Archer's strike sends one flying in an arc from the archer to what it shot at. Render-only; the
// damage has landed in the simulation already.
import * as THREE from 'three';
import { TICKS_PER_SECOND } from '../sim/gameTime';
import { UnitKind } from '../sim/UnitKind';
import type { World } from '../sim/World';
import { targetTile } from './UnitLayer';
import { walkHeight } from './walkHeight';
import type { WorldLayer } from './WorldLayer';

/** Arrow look and flight; frozen, tune by editing the source. */
export const ARROW_CONFIG = Object.freeze({
  capacity: 128,
  length: 0.4,
  /** Seconds of game time an arrow is in the air. */
  flightSeconds: 0.4,
  /** Height of the bow and of the point hit, above the ground or wall walk. */
  height: 0.55,
  arc: 0.6,
  color: 0x3a2a1a,
});

/** One arrow in the air. */
interface Flight {
  readonly from: THREE.Vector3;
  readonly to: THREE.Vector3;
  /** Game time (seconds) it was loosed at. */
  readonly start: number;
}

export class ArrowFlights implements WorldLayer {
  /** Add this to the scene; the arrows' instanced mesh (`arrows`). */
  public readonly object = new THREE.Group();
  private readonly geometry = new THREE.BoxGeometry(0.02, 0.02, ARROW_CONFIG.length);
  private readonly material = new THREE.MeshBasicMaterial({ color: ARROW_CONFIG.color });
  private readonly mesh = new THREE.InstancedMesh(this.geometry, this.material, ARROW_CONFIG.capacity);
  /** The strike tick last seen for each archer, so each strike looses one arrow. */
  private readonly lastSeen = new Map<number, number>();
  private flights: Flight[] = [];
  private readonly at = new THREE.Vector3();
  private readonly ahead = new THREE.Vector3();
  private readonly matrix = new THREE.Matrix4();
  private readonly up = new THREE.Vector3(0, 1, 0);

  /** Creates the empty arrow mesh. */
  public constructor() {
    this.mesh.name = 'arrows';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.object.add(this.mesh);
  }

  /** Arrows in the air right now. */
  public get inFlight(): number {
    return this.flights.length;
  }

  /** Looses an arrow for each new Archer strike in `world`, moves the arrows in the air and drops landed ones. */
  public update(world: World, tickFraction: number): void {
    const now = (world.tickCount + tickFraction) / TICKS_PER_SECOND;
    for (const unit of world.units()) {
      if (unit.kind !== UnitKind.Archer || unit.lastStrikeTick < 0 || this.lastSeen.get(unit.id) === unit.lastStrikeTick) continue;
      this.lastSeen.set(unit.id, unit.lastStrikeTick);
      const to = targetTile(world, unit);
      if (!to || this.flights.length >= ARROW_CONFIG.capacity) continue;
      const from = new THREE.Vector3(unit.tx + 0.5, walkHeight(world, unit.tx, unit.ty) + ARROW_CONFIG.height, unit.ty + 0.5);
      const end = new THREE.Vector3(to.x, world.map.tileHeight(Math.floor(to.x), Math.floor(to.y)) + ARROW_CONFIG.height, to.y);
      this.flights.push({ from, to: end, start: unit.lastStrikeTick / TICKS_PER_SECOND });
    }
    this.flights = this.flights.filter((f) => now - f.start < ARROW_CONFIG.flightSeconds);
    this.flights.forEach((flight, i) => this.mesh.setMatrixAt(i, this.place(flight, now)));
    this.mesh.count = this.flights.length;
    this.mesh.visible = this.flights.length > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Frees the mesh, geometry and material. Call once. */
  public dispose(): void {
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.object.clear();
    this.flights = [];
    this.lastSeen.clear();
  }

  /** The arrow's matrix `now`: along its arc, pointing the way it flies. */
  private place(flight: Flight, now: number): THREE.Matrix4 {
    const t = Math.max(0, Math.min(1, (now - flight.start) / ARROW_CONFIG.flightSeconds));
    this.pointAt(flight, t, this.at);
    this.pointAt(flight, Math.min(1, t + 0.05), this.ahead);
    if (this.ahead.distanceToSquared(this.at) < 1e-8) this.ahead.copy(flight.to).add(this.up);
    return this.matrix.lookAt(this.ahead, this.at, this.up).setPosition(this.at);
  }

  private pointAt(flight: Flight, t: number, out: THREE.Vector3): THREE.Vector3 {
    out.lerpVectors(flight.from, flight.to, t);
    out.y += ARROW_CONFIG.arc * 4 * t * (1 - t);
    return out;
  }
}
