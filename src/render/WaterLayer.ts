// The sea: one plane at sea level over the map and an open sea far past its edges, coloured by a shader from a texture of the water depth at each corner.
import * as THREE from 'three';
import type { GameMap } from '../sim/GameMap';
import { MAPGEN_CONFIG } from '../sim/MapGenerator';
import { WATER_FRAGMENT_SHADER, WATER_VERTEX_SHADER } from './waterShader';
import type { WorldLayer } from './WorldLayer';

/** Water tuning, in world units and sRGB hex colours. Tune by editing these values. */
export const WATER_CONFIG = Object.freeze({
  /** Depth range stored in the depth texture: from this far above the sea (negative) to this far below it. */
  landDepth: -1.5,
  maxDepth: 6,
  /** Black, threatening sea: a thin band of murky green at the shore, then ink-dark depths and grey, dirty foam. */
  shallowColor: 0x32463e,
  midColor: 0x15232a,
  deepColor: 0x05090c,
  foamColor: 0x8c8a80,
  /** How far the open sea reaches past every map edge, in world units: beyond the camera's far plane, so it never ends. */
  openSeaMargin: 1500,
  /** Longest frame step the waves advance by, so a stalled tab does not jump them. */
  maxStep: 0.1,
});

/** Water depth (sea level minus height) at every corner, mapped from [landDepth, maxDepth] to 0..255. Pure. */
export function encodeWaterDepth(map: GameMap): Uint8Array {
  const { landDepth, maxDepth } = WATER_CONFIG;
  const data = new Uint8Array((map.width + 1) * (map.height + 1));
  for (let i = 0; i < data.length; i++) {
    const t = (MAPGEN_CONFIG.seaLevel - map.heights[i] - landDepth) / (maxDepth - landDepth);
    data[i] = Math.round(255 * Math.min(1, Math.max(0, t)));
  }
  return data;
}

export class WaterLayer implements WorldLayer {
  /** Add this to the scene; holds the sea surface. */
  public readonly object = new THREE.Group();
  private readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly depthTexture: THREE.DataTexture;
  private readonly clock = new THREE.Clock();

  /** Builds the sea surface for `map`. Call once per map; `dispose` frees it. */
  public constructor(map: GameMap) {
    const c = WATER_CONFIG;
    this.depthTexture = new THREE.DataTexture(encodeWaterDepth(map), map.width + 1, map.height + 1, THREE.RedFormat);
    this.depthTexture.magFilter = THREE.LinearFilter;
    this.depthTexture.minFilter = THREE.LinearFilter;
    this.depthTexture.needsUpdate = true;
    const geometry = new THREE.PlaneGeometry(map.width + 2 * c.openSeaMargin, map.height + 2 * c.openSeaMargin)
      .rotateX(-Math.PI / 2) // plane normal +z -> +y
      .translate(map.width / 2, MAPGEN_CONFIG.seaLevel, map.height / 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: WATER_VERTEX_SHADER,
      fragmentShader: WATER_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        depthMap: { value: this.depthTexture },
        mapSize: { value: new THREE.Vector2(map.width, map.height) },
        time: { value: 0 },
        landDepth: { value: c.landDepth },
        maxDepth: { value: c.maxDepth },
        shallowColor: { value: new THREE.Color(c.shallowColor) },
        midColor: { value: new THREE.Color(c.midColor) },
        deepColor: { value: new THREE.Color(c.deepColor) },
        foamColor: { value: new THREE.Color(c.foamColor) },
      },
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.object.add(this.mesh);
  }

  /** Seconds of wave motion so far. */
  public get time(): number {
    return this.mesh.material.uniforms.time.value as number;
  }

  /** Moves the waves on by the wall-clock time since the last frame. Part of WorldLayer; call once per frame. */
  public update(): void {
    this.advance(this.clock.getDelta());
  }

  /** Moves the waves on by `seconds` (at most WATER_CONFIG.maxStep). Call from `update`, or directly in tests. */
  public advance(seconds: number): void {
    const step = Math.min(WATER_CONFIG.maxStep, Math.max(0, seconds));
    this.mesh.material.uniforms.time.value = this.time + step;
  }

  /** Removes the surface and frees its geometry, material and depth texture. Call once. */
  public dispose(): void {
    this.object.clear();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.depthTexture.dispose();
  }
}
