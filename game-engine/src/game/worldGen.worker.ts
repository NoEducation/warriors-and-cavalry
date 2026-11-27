// Entry point of the world-generation worker: runs one WorldGenJob per request and posts its stages and result back.
import { type WorldGenReply, type WorldGenRequest, WorldGenJob } from './WorldGenJob';

/** The parts of the worker's global scope used here (the DOM lib types `self` as a window). */
interface WorkerScope {
  onmessage: ((event: MessageEvent<WorldGenRequest>) => void) | null;
  postMessage(message: WorldGenReply, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;
const job = new WorldGenJob();

scope.onmessage = (event: MessageEvent<WorldGenRequest>): void => {
  const { id, params } = event.data;
  try {
    const result = job.run(params, (stage) => scope.postMessage({ type: 'stage', id, stage }));
    scope.postMessage({ type: 'done', id, result }, job.transferables(result));
  } catch (err) {
    scope.postMessage({ type: 'error', id, message: err instanceof Error ? err.message : String(err) });
  }
};
