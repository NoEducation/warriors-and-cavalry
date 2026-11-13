// The 3D scene for a world: background, lights, terrain, water, trees, buildings, stockpile stacks and crops.
import * as THREE from 'three';
import { MAPGEN_CONFIG } from '../sim/MapGenerator';
import type { World } from '../sim/World';
import { BuildingLayer } from './BuildingLayer';
import { BuildingMeshFactory } from './BuildingMeshFactory';
import { disposeObject } from './disposeObject';
import { FarmCrops } from './FarmCrops';
import { StockpileStacks } from './StockpileStacks';
import { TerrainMeshBuilder } from './TerrainMeshBuilder';
import { TreeLayer } from './TreeLayer';
import { WaterMeshBuilder } from './WaterMeshBuilder';
import type { WorldLayer } from './WorldLayer';

export class WorldView {
  public readonly scene = new THREE.Scene();
  private readonly terrainBuilder = new TerrainMeshBuilder();
  private readonly waterBuilder = new WaterMeshBuilder();
  private readonly buildingFactory = new BuildingMeshFactory();
  private terrainChunks: THREE.Group | null = null;
  private waterMesh: THREE.Mesh | null = null;
  /** Trees, buildings, stockpile stacks and crops of the shown world, in drawing order; empty before `showWorld`. */
  private readonly layers: WorldLayer[] = [];

  /** Creates the scene with background and lights; no world is shown until `showWorld`. */
  public constructor() {
    this.scene.background = new THREE.Color(0x1b2a38);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-0.6, 1, -0.4); // shines towards the origin (default target)
    this.scene.add(sun);
  }

  /**
   * Replaces everything shown with meshes for `world`: terrain, water, trees, and buildings, stockpile stacks and crops
   * (which then follow the world's changes). Call on every world load.
   */
  public showWorld(world: World): void {
    const { map } = world;
    this.clearWorld();
    this.terrainChunks = this.terrainBuilder.build(map);
    this.waterMesh = this.waterBuilder.build(map, MAPGEN_CONFIG.seaLevel);
    this.scene.add(this.terrainChunks, this.waterMesh);
    this.layers.push(
      new TreeLayer(world),
      new BuildingLayer(world, this.buildingFactory),
      new StockpileStacks(world),
      new FarmCrops(world),
    );
    for (const layer of this.layers) this.scene.add(layer.object);
  }

  /** Brings every layer (e.g. stockpile stacks and crops) in line with the shown world. Call once per frame. */
  public update(): void {
    for (const layer of this.layers) layer.update();
  }

  /** Removes and frees everything shown. Call when the view is no longer needed. */
  public dispose(): void {
    this.clearWorld();
  }

  private clearWorld(): void {
    for (const object of [this.terrainChunks, this.waterMesh]) {
      if (!object) continue;
      this.scene.remove(object);
      disposeObject(object);
    }
    for (const layer of this.layers) {
      this.scene.remove(layer.object);
      layer.dispose();
    }
    this.terrainChunks = null;
    this.waterMesh = null;
    this.layers.length = 0;
  }
}
