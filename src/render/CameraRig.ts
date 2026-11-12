// RTS camera: orbits a focus point on the ground; keys pan and rotate, the wheel zooms.
import * as THREE from 'three';
import { CAMERA_CONFIG, clamp, clampDt, orbitOffset, panDelta, zoomDistance } from './cameraMath';

/** Anything that can tell whether a key (by `KeyboardEvent.code`) is held. */
export interface HeldKeys {
  isDown(code: string): boolean;
}

const DEG = Math.PI / 180;

export class CameraRig {
  public readonly camera: THREE.PerspectiveCamera;
  private readonly focus: THREE.Vector3;
  private yaw = 0;
  private distance: number = CAMERA_CONFIG.startDistance;

  /** Starts looking at the centre of a map of the given size; panning stays within it. */
  public constructor(
    private readonly mapWidth: number,
    private readonly mapHeight: number,
  ) {
    this.camera = new THREE.PerspectiveCamera(CAMERA_CONFIG.fovDeg, 1, 1, 1000);
    this.focus = new THREE.Vector3(mapWidth / 2, 0, mapHeight / 2);
    this.place();
  }

  /** Pans (WASD/arrows) and rotates (Q/E) from the held keys. Call once per frame. */
  public update(dtSeconds: number, keys: HeldKeys): void {
    const dt = clampDt(dtSeconds);
    const held = (a: string, b: string): number => (keys.isDown(a) || keys.isDown(b) ? 1 : 0);

    const forward = held('KeyW', 'ArrowUp') - held('KeyS', 'ArrowDown');
    const right = held('KeyD', 'ArrowRight') - held('KeyA', 'ArrowLeft');
    const speed = this.distance * CAMERA_CONFIG.panSpeedPerDistance;
    const { dx, dz } = panDelta(forward, right, this.yaw, speed, dt);
    this.focus.x = clamp(this.focus.x + dx, 0, this.mapWidth);
    this.focus.z = clamp(this.focus.z + dz, 0, this.mapHeight);

    // Q turns the view counter-clockwise seen from above (increasing yaw), E clockwise.
    const turn = (keys.isDown('KeyQ') ? 1 : 0) - (keys.isDown('KeyE') ? 1 : 0);
    this.yaw += turn * CAMERA_CONFIG.rotateSpeedDeg * DEG * dt;

    this.place();
  }

  /** Zooms out for a positive wheel delta and in for a negative one. Call from the wheel handler. */
  public zoom(wheelDeltaY: number): void {
    this.distance = zoomDistance(this.distance, wheelDeltaY);
    this.place();
  }

  /** Sets the camera's width/height ratio. Call whenever the render size changes. */
  public setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  private place(): void {
    const o = orbitOffset(this.yaw, CAMERA_CONFIG.pitchDeg * DEG, this.distance);
    this.camera.position.set(this.focus.x + o.x, this.focus.y + o.y, this.focus.z + o.z);
    this.camera.lookAt(this.focus);
  }
}
