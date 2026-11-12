// The 3D scene for a map: background, lights, terrain and water.
import * as THREE from 'three';
import { MAPGEN_CONFIG } from '../sim/MapGenerator';
import type { World } from '../sim/World';
import { disposeObject } from './disposeObject';
import { TerrainMeshBuilder } from './TerrainMeshBuilder';
import { WaterMeshBuilder } from './WaterMeshBuilder';

export class WorldView {
  public readonly scene = new THREE.Scene();
  private readonly terrainBuilder = new TerrainMeshBuilder();
  private readonly waterBuilder = new WaterMeshBuilder();
  private terrainChunks: THREE.Group | null = null;
  private waterMesh: THREE.Mesh | null = null;

  /** Creates the scene with background and lights; no world is shown until `showWorld`. */
  public constructor() {
    this.scene.background = new THREE.Color(0x1b2a38);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-0.6, 1, -0.4); // shines towards the origin (default target)
    this.scene.add(sun);
  }

  /** Replaces the shown terrain and water with meshes for `world`'s map. Call on every world load. */
  public showWorld(world: World): void {
    const { map } = world;
    this.clearMap();
    this.terrainChunks = this.terrainBuilder.build(map);
    this.waterMesh = this.waterBuilder.build(map, MAPGEN_CONFIG.seaLevel);
    this.scene.add(this.terrainChunks, this.waterMesh);
  }

  /** Removes and frees the map meshes. Call when the view is no longer needed. */
  public dispose(): void {
    this.clearMap();
  }

  private clearMap(): void {
    for (const object of [this.terrainChunks, this.waterMesh]) {
      if (!object) continue;
      this.scene.remove(object);
      disposeObject(object);
    }
    this.terrainChunks = null;
    this.waterMesh = null;
  }
}
