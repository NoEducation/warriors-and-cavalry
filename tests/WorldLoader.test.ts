import { describe, expect, it } from 'vitest';
import { TerrainMeshBuilder } from '../src/render/TerrainMeshBuilder';
import { MapGenerator } from '../src/sim/MapGenerator';
import { worldChecksum } from '../src/sim/worldChecksum';
import { WorldAssembler } from '../src/game/WorldAssembler';
import { type WorldGenStage, WORLD_GEN_STAGES, WorldGenJob } from '../src/game/WorldGenJob';
import { WorldLoader } from '../src/game/WorldLoader';

const params = { seed: 11, width: 80, height: 72 };

describe('WorldGenJob', () => {
  it('reports every stage but the last, in order', () => {
    const stages: WorldGenStage[] = [];
    new WorldGenJob().run(params, (s) => stages.push(s));
    expect([...stages, 'assembling']).toEqual(Object.keys(WORLD_GEN_STAGES));
  });

  it('lists each array buffer once for transfer', () => {
    const job = new WorldGenJob();
    const result = job.run(params, () => {});
    const buffers = job.transferables(result);
    expect(new Set(buffers).size).toBe(buffers.length);
    expect(buffers).toHaveLength(3 + result.terrain.length * 3);
  });

  it('assembles, after a structured clone, into the world MapGenerator.generate makes, with matching terrain', () => {
    const result = new WorldGenJob().run(params, () => {});
    const { world, terrain } = new WorldAssembler().assemble(structuredClone(result));
    const expected = new MapGenerator().generate(params);
    expect(worldChecksum(world)).toBe(worldChecksum(expected));
    expect(terrain).toEqual(new TerrainMeshBuilder().buildData(expected.map));
  });
});

describe('WorldLoader without a worker', () => {
  it('loads the world MapGenerator.generate makes and reports every stage in order', async () => {
    const stages: WorldGenStage[] = [];
    const loader = new WorldLoader();
    const { world } = await loader.load(params, (s) => stages.push(s));
    expect(worldChecksum(world)).toBe(worldChecksum(new MapGenerator().generate(params)));
    expect(stages).toEqual(Object.keys(WORLD_GEN_STAGES));
    loader.dispose();
  });
});
