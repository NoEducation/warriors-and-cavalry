// The 3D scene for a world: background, fog, lights, terrain, water, trees, buildings, stockpile stacks, crops, peasants,
// soldiers and raiders, arrows and health bars.
import * as THREE from 'three';
import type { World } from '../sim/World';
import { ArrowFlights } from './ArrowFlights';
import { BuildingLayer } from './BuildingLayer';
import { BuildingMeshFactory } from './BuildingMeshFactory';
import { disposeObject } from './disposeObject';
import { FarmCrops } from './FarmCrops';
import { HealthBars } from './HealthBars';
import { PeasantLayer } from './PeasantLayer';
import { SCENE_LOOK_CONFIG } from './sceneLook';
import { StockpileStacks } from './StockpileStacks';
import { type TerrainChunkData, TerrainMeshBuilder } from './TerrainMeshBuilder';
import { StumpLayer } from './StumpLayer';
import { TreeLayer } from './TreeLayer';
import { TreeShadowLayer } from './TreeShadowLayer';
import { UnitLayer } from './UnitLayer';
import { WaterLayer } from './WaterLayer';
import type { WorldLayer } from './WorldLayer';

export class WorldView {
  public readonly scene = new THREE.Scene();
  private readonly terrainBuilder = new TerrainMeshBuilder();
  private readonly buildingFactory = new BuildingMeshFactory();
  private terrainChunks: THREE.Group | null = null;
  /** Water, tree shadows, trees, buildings, stockpile stacks, crops and peasants of the shown world, in drawing order; empty at first. */
  private readonly layers: WorldLayer[] = [];
  private unitLayer: UnitLayer | null = null;

  /** Creates the scene with background, fog and lights; no world is shown until `showWorld`. */
  public constructor() {
    const look = SCENE_LOOK_CONFIG;
    this.scene.background = new THREE.Color(look.background);
    this.scene.fog = new THREE.Fog(look.fogColor, look.fogNear, look.fogFar);
    // Overcast sky light and a dark earth bounce keep shadowed slopes readable; a low copper sun gives relief.
    this.scene.add(new THREE.HemisphereLight(look.skyLight, look.groundLight, look.hemisphereIntensity));
    this.scene.add(new THREE.AmbientLight(0xffffff, look.ambientIntensity));
    const sun = new THREE.DirectionalLight(look.sunColor, look.sunIntensity);
    sun.position.set(look.sunDirection.x, look.sunDirection.y, look.sunDirection.z); // shines towards the origin (default target)
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
    this.unitLayer = new UnitLayer();
    this.layers.push(this.unitLayer, new ArrowFlights(), new HealthBars(this.unitLayer));
    for (const layer of this.layers) this.scene.add(layer.object);
  }

  /**
   * Brings every layer (e.g. buildings, stockpile stacks, crops and peasants) in line with `world`, the one last passed
   * to `showWorld`, `tickFraction` of a tick past the last simulation tick. Call once per frame, after ticking.
   */
  public update(world: World, tickFraction: number): void {
    for (const layer of this.layers) layer.update(world, tickFraction);
  }

  /** The soldiers' and raiders' layer of the shown world, which knows where each unit is drawn; null before `showWorld`. */
  public get units(): UnitLayer | null {
    return this.unitLayer;
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
    this.unitLayer = null;
  }
}
