// Makes worlds off the main thread: posts each request to the world-generation worker and assembles its result, or
// runs the job on the main thread where no worker can be started (tests, a failed worker).
import type { MapParams } from '../sim/MapGenerator';
import { type LoadedWorld, WorldAssembler } from './WorldAssembler';
import { type WorldGenReply, type WorldGenResult, type WorldGenStage, WorldGenJob } from './WorldGenJob';

/** Called as each step of a load starts. */
export type StageListener = (stage: WorldGenStage) => void;

/** A load waiting for the worker. */
interface PendingLoad {
  readonly params: MapParams;
  readonly onStage: StageListener;
  readonly resolve: (result: WorldGenResult) => void;
  readonly reject: (error: Error) => void;
}

export class WorldLoader {
  private readonly assembler = new WorldAssembler();
  private readonly pending = new Map<number, PendingLoad>();
  private worker: Worker | null;
  private nextId = 1;

  /** Starts the worker; without `Worker` support (e.g. in Node) every load runs on the main thread instead. */
  public constructor() {
    this.worker = this.startWorker();
  }

  /**
   * Makes the world for `params`, calling `onStage` as each step starts. Resolves once the slow work is done (off the
   * main thread when the worker runs) and the world is assembled; the same params always give the same world.
   */
  public async load(params: MapParams, onStage: StageListener): Promise<LoadedWorld> {
    const result = await this.generate(params, onStage);
    onStage('assembling');
    await nextPaint();
    return this.assembler.assemble(result);
  }

  /** Stops the worker. Loads still waiting are rejected. */
  public dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const load of this.pending.values()) load.reject(new Error('World loader disposed'));
    this.pending.clear();
  }

  private generate(params: MapParams, onStage: StageListener): Promise<WorldGenResult> {
    const worker = this.worker;
    if (!worker) return this.generateHere(params, onStage);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { params, onStage, resolve, reject });
      worker.postMessage({ id, params });
    });
  }

  /** Runs the job on the main thread, after a paint so the loader is on screen during the freeze. */
  private async generateHere(params: MapParams, onStage: StageListener): Promise<WorldGenResult> {
    await nextPaint();
    return new WorldGenJob().run(params, onStage);
  }

  private startWorker(): Worker | null {
    if (typeof Worker === 'undefined') return null;
    const worker = new Worker(new URL('./worldGen.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorldGenReply>): void => this.onReply(event.data);
    worker.onerror = (event: ErrorEvent): void => this.onWorkerFailed(event);
    return worker;
  }

  private onReply(reply: WorldGenReply): void {
    const load = this.pending.get(reply.id);
    if (!load) return;
    if (reply.type === 'stage') return load.onStage(reply.stage);
    this.pending.delete(reply.id);
    if (reply.type === 'done') load.resolve(reply.result);
    else load.reject(new Error(reply.message));
  }

  /** The worker could not start or crashed: drop it and finish every waiting load on the main thread. */
  private onWorkerFailed(event: ErrorEvent): void {
    console.error('World generation worker failed; generating on the main thread.', event.message);
    this.worker?.terminate();
    this.worker = null;
    const loads = [...this.pending.values()];
    this.pending.clear();
    for (const load of loads) this.generateHere(load.params, load.onStage).then(load.resolve, load.reject);
  }
}

/** Resolves after the browser has had a chance to paint (next animation frame, then a task); a task in Node. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'undefined') setTimeout(resolve, 0);
    else requestAnimationFrame(() => setTimeout(resolve, 0));
  });
}
