// Turns a world-generation result into the world and the terrain data to show: the cheap part, on the main thread.
import type { TerrainChunkData } from '../render/TerrainMeshBuilder';
import { GameMap } from '../sim/GameMap';
import { MapGenerator } from '../sim/MapGenerator';
import type { World } from '../sim/World';
import type { WorldGenResult } from './WorldGenJob';

/** A world ready to show: the simulation state and its terrain chunk data for `WorldView.showWorld`. */
export interface LoadedWorld {
  readonly world: World;
  readonly terrain: readonly TerrainChunkData[];
}

export class WorldAssembler {
  private readonly generator = new MapGenerator();

  /** Wraps `result`'s arrays in a map and makes its world, spawning the planned trees. Takes ownership of the arrays. */
  public assemble(result: WorldGenResult): LoadedWorld {
    const map = new GameMap(result.width, result.height, result.seed, result.heights, result.tiles);
    const world = this.generator.buildWorld({ map, treeTiles: result.treeTiles });
    return { world, terrain: result.terrain };
  }
}
