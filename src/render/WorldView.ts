// The 3D scene for a world: background, lights, terrain, water, trees, buildings, stockpile stacks, crops and peasants.
import * as THREE from 'three';
import type { World } from '../sim/World';
import { BuildingLayer } from './BuildingLayer';
import { BuildingMeshFactory } from './BuildingMeshFactory';
import { disposeObject } from './disposeObject';
import { FarmCrops } from './FarmCrops';
import { PeasantLayer } from './PeasantLayer';
import { StockpileStacks } from './StockpileStacks';
import { type TerrainChunkData, TerrainMeshBuilder } from './TerrainMeshBuilder';
import { StumpLayer } from './StumpLayer';
import { TreeLayer } from './TreeLayer';
import { TreeShadowLayer } from './TreeShadowLayer';
import { WaterLayer } from './WaterLayer';
import type { WorldLayer } from './WorldLayer';

export class WorldView {
  public readonly scene = new THREE.Scene();
  private readonly terrainBuilder = new TerrainMeshBuilder();
  private readonly buildingFactory = new BuildingMeshFactory();
  private terrainChunks: THREE.Group | null = null;
  /** Water, tree shadows, trees, buildings, stockpile stacks, crops and peasants of the shown world, in drawing order; empty at first. */
  private readonly layers: WorldLayer[] = [];

  /** Creates the scene with background and lights; no world is shown until `showWorld`. */
  public constructor() {
    this.scene.background = new THREE.Color(0x1b2a38);
    // Sky light from above and bounce light from the ground keep shadowed slopes readable; a warm, low sun gives relief.
    this.scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x5a4a30, 1.1));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.15));
    const sun = new THREE.DirectionalLight(0xfff1d8, 2.1);
    sun.position.set(-0.8, 0.85, -0.35); // shines towards the origin (default target)
    this.scene.add(sun);
  }

  /**
   * Replaces everything shown with meshes for `world`: terrain, water, trees and stumps, and buildings, stockpile stacks, crops
   * and peasants (which then follow the world passed to `update`). Call on every world load. `terrain` is the map's
   * chunk data from `TerrainMeshBuilder.buildData` when already computed (e.g. in a worker); without it it is built here.
   */
  public showWorld(world: World, terrain?: readonly TerrainChunkData[]): void {
    const { map } = world;
    this.clearWorld();
    this.terrainChunks = terrain ? this.terrainBuilder.fromData(terrain) : this.terrainBuilder.build(map);
    this.scene.add(this.terrainChunks);
    this.layers.push(
      new WaterLayer(map),
      new TreeShadowLayer(world),
      new TreeLayer(world),
      new StumpLayer(world),
      new BuildingLayer(world, this.buildingFactory),
      new StockpileStacks(world),
      new FarmCrops(world),
      new PeasantLayer(),
    );
    for (const layer of this.layers) this.scene.add(layer.object);
  }

  /**
   * Brings every layer (e.g. buildings, stockpile stacks, crops and peasants) in line with `world`, the one last passed
   * to `showWorld`, `tickFraction` of a tick past the last simulation tick. Call once per frame, after ticking.
   */
  public update(world: World, tickFraction: number): void {
    for (const layer of this.layers) layer.update(world, tickFraction);
  }

  /** Removes and frees everything shown. Call when the view is no longer needed. */
  public dispose(): void {
    this.clearWorld();
  }

  private clearWorld(): void {
    if (this.terrainChunks) {
      this.scene.remove(this.terrainChunks);
      disposeObject(this.terrainChunks);
    }
    for (const layer of this.layers) {
      this.scene.remove(layer.object);
      layer.dispose();
    }
    this.terrainChunks = null;
    this.layers.length = 0;
  }
}
