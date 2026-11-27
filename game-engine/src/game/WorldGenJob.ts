// The heavy part of making a world, as one job that runs in the world-generation worker (or on the main thread when
// there is none): terrain, forest plan and terrain chunk vertex data, returned as transferable typed arrays.
import { type TerrainChunkData, TerrainMeshBuilder } from '../render/TerrainMeshBuilder';
import { MapGenerator, type MapParams } from '../sim/MapGenerator';

/** The steps of loading a world, in order, with the text the loader shows for each. */
export const WORLD_GEN_STAGES = Object.freeze({
  terrain: 'Shaping the land',
  mesh: 'Laying out the ground',
  assembling: 'Raising the realm',
});

export type WorldGenStage = keyof typeof WORLD_GEN_STAGES;

/** Everything the job computed for one map: plain data, safe to post between threads. */
export interface WorldGenResult extends MapParams {
  readonly heights: Float32Array;
  readonly tiles: Uint8Array;
  readonly treeTiles: Uint32Array;
  readonly terrain: readonly TerrainChunkData[];
}

/** A request to the worker: make the map for `params`; replies carry the same `id`. */
export interface WorldGenRequest {
  readonly id: number;
  readonly params: MapParams;
}

/** A reply from the worker: a stage started, the finished result, or a failure. */
export type WorldGenReply =
  | { readonly type: 'stage'; readonly id: number; readonly stage: WorldGenStage }
  | { readonly type: 'done'; readonly id: number; readonly result: WorldGenResult }
  | { readonly type: 'error'; readonly id: number; readonly message: string };

export class WorldGenJob {
  private readonly generator = new MapGenerator();
  private readonly terrainBuilder = new TerrainMeshBuilder();

  /** Computes the map, forest plan and terrain chunk data for `params`, calling `onStage` as each step starts. */
  public run(params: MapParams, onStage: (stage: WorldGenStage) => void): WorldGenResult {
    onStage('terrain');
    const { map, treeTiles } = this.generator.generateLayout(params);
    onStage('mesh');
    const terrain = this.terrainBuilder.buildData(map);
    const { width, height, seed, heights, tiles } = map;
    return { width, height, seed, heights, tiles, treeTiles, terrain };
  }

  /** The buffers of `result` to transfer (not copy) when posting it to another thread. */
  public transferables(result: WorldGenResult): ArrayBuffer[] {
    const arrays: ArrayBufferView[] = [result.heights, result.tiles, result.treeTiles];
    for (const chunk of result.terrain) arrays.push(chunk.positions, chunk.colors, chunk.normals);
    return arrays.map((a) => a.buffer as ArrayBuffer);
  }
}
