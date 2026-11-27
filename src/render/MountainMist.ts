// Mist caught on the mountains: soft, drifting banks over the rock tiles that thin out as the camera comes close.
import * as THREE from 'three';
import type { GameMap } from '../sim/GameMap';
import { MIST_CONFIG, mistBanks } from './mistBanks';
import { MIST_FRAGMENT_SHADER, MIST_VERTEX_SHADER } from './mistShader';
import type { WorldLayer } from './WorldLayer';

/** Longest frame step the wisps advance by, so a stalled tab does not jump them. */
const MAX_STEP = 0.1;

export class MountainMist implements WorldLayer {
  /** Add this to the scene; holds the mist banks (nothing when the map has no mountains). */
  public readonly object = new THREE.Group();
  private readonly mesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
  private readonly clock = new THREE.Clock();
  private elapsed = 0;

  /** Builds the mist banks of `map`. Call once per map; `dispose` frees them. */
  public constructor(map: GameMap) {
    const banks = mistBanks(map);
    if (banks.length === 0) return;
    const c = MIST_CONFIG;
    const geometry = new THREE.PlaneGeometry(2, 2); // a unit-radius quad; the per-bank attributes are instanced
    const bank = new Float32Array(banks.length * 4);
    const phase = new Float32Array(banks.length);
    banks.forEach((b, i) => {
      bank.set([b.x, b.y, b.z, b.radius], i * 4);
      phase[i] = b.phase;
    });
    geometry.setAttribute('bank', new THREE.InstancedBufferAttribute(bank, 4));
    geometry.setAttribute('phase', new THREE.InstancedBufferAttribute(phase, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: MIST_VERTEX_SHADER,
      fragmentShader: MIST_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        mistColor: { value: new THREE.Color(c.color) },
        opacity: { value: c.opacity },
        time: { value: 0 },
        drift: { value: c.drift },
        fadeNear: { value: c.fadeNear },
        fadeFar: { value: c.fadeFar },
      },
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, banks.length);
    this.mesh.frustumCulled = false; // the banks are placed by the shader, not by instance matrices
    this.mesh.renderOrder = 1; // after the water, so the sea does not hide mist over the coast
    this.object.add(this.mesh);
  }

  /** Seconds of drift so far. */
  public get time(): number {
    return this.elapsed;
  }

  /** Moves the wisps on by the wall-clock time since the last frame. Part of WorldLayer; call once per frame. */
  public update(): void {
    this.advance(this.clock.getDelta());
  }

  /** Moves the wisps on by `seconds` (at most 0.1). Call from `update`, or directly in tests. */
  public advance(seconds: number): void {
    this.elapsed += Math.min(MAX_STEP, Math.max(0, seconds));
    if (this.mesh) this.mesh.material.uniforms.time.value = this.elapsed;
  }

  /** Removes the banks and frees their geometry and material. Call once. */
  public dispose(): void {
    this.object.clear();
    this.mesh?.geometry.dispose();
    this.mesh?.material.dispose();
  }
}
