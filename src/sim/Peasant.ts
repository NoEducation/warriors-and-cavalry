// One peasant: its state and every change to it, each a named transition.
import type { TileCoord } from './TileCoord';
import type { Load, PeasantState, PeasantView } from './PeasantView';

const NO_TILES: readonly TileCoord[] = Object.freeze([]);

/**
 * The mutable peasant record. Its fields change only through the transitions below, which `Population` and its
 * helpers call; everyone else sees it as a `PeasantView`.
 */
export class Peasant implements PeasantView {
  private _state: PeasantState = 'idle';
  private _tx: number;
  private _ty: number;
  private _nextTx: number;
  private _nextTy: number;
  private _stepProgress = 0;
  private _stepTicks = 0;
  private _load: Load | null = null;
  private _workplaceId: number | null = null;
  private _targetId: number | null = null;
  private _waitTicks = 0;
  private _path = NO_TILES;
  private _pathIndex = 0;
  private _goals = NO_TILES;

  /** A new, idle peasant standing on tile (tx, ty). */
  public constructor(public readonly id: number, tx: number, ty: number) {
    this._tx = this._nextTx = tx;
    this._ty = this._nextTy = ty;
  }

  public get state(): PeasantState { return this._state; }
  public get tx(): number { return this._tx; }
  public get ty(): number { return this._ty; }
  public get nextTx(): number { return this._nextTx; }
  public get nextTy(): number { return this._nextTy; }
  public get stepProgress(): number { return this._stepProgress; }
  public get stepTicks(): number { return this._stepTicks; }
  public get load(): Load | null { return this._load; }
  public get workplaceId(): number | null { return this._workplaceId; }
  public get targetId(): number | null { return this._targetId; }
  public get waitTicks(): number { return this._waitTicks; }
  public get path(): readonly TileCoord[] { return this._path; }
  public get pathIndex(): number { return this._pathIndex; }
  public get goals(): readonly TileCoord[] { return this._goals; }

  /** idle -> toWork: takes the job at building `buildingId` and heads there. */
  public takeJob(buildingId: number): void {
    this._workplaceId = buildingId;
    this._state = 'toWork';
  }

  /** toWork or toWorkBack -> working: stands at its workplace, so the building's production advances. */
  public startWorking(): void {
    this._state = 'working';
  }

  /** working -> toStore: takes its building's finished batch to carry to storage. */
  public pickUp(load: Load): void {
    this._load = load;
    this._state = 'toStore';
  }

  /** Sets the storage place it carries its load to; null when none is in reach. */
  public setTarget(storeId: number | null): void {
    this._targetId = storeId;
  }

  /** toStore -> toWorkBack: hands over its load at the storage place and returns it. */
  public deliver(): Load | null {
    const load = this._load;
    this._load = null;
    this._targetId = null;
    this._state = 'toWorkBack';
    return load;
  }

  /** Any state -> idle: drops its job, load, target, wait and walk where it stands; a step under way is finished. */
  public goIdle(): void {
    this._state = 'idle';
    this._workplaceId = null;
    this._load = null;
    this._targetId = null;
    this._waitTicks = 0;
    this.startWalk(NO_TILES, NO_TILES);
  }

  /** Waits `ticks` ticks before searching again (after a failed search). */
  public wait(ticks: number): void {
    this._waitTicks = ticks;
  }

  /** Counts a wait down by one tick; true when the wait has just ended. Call only while waiting. */
  public countDownWait(): boolean {
    return --this._waitTicks === 0;
  }

  /** Replaces the current walk with `path` toward `goals` (both empty to stop after the current step). */
  public startWalk(path: readonly TileCoord[], goals: readonly TileCoord[]): void {
    this._path = path;
    this._pathIndex = 0;
    this._goals = goals;
  }

  /** Starts the step onto the next tile of its walk, taking `ticks` ticks. Call only between steps, with tiles left. */
  public stepToNextTile(ticks: number): void {
    const next = this._path[this._pathIndex++];
    this._nextTx = next.tx;
    this._nextTy = next.ty;
    this._stepProgress = 0;
    this._stepTicks = ticks;
  }

  /** Advances the current step by one tick; on its last tick it stands on the next tile and stops moving. */
  public advanceStep(): void {
    this._stepProgress++;
    if (this._stepProgress < this._stepTicks) return;
    this._tx = this._nextTx;
    this._ty = this._nextTy;
    this._stepProgress = 0;
    this._stepTicks = 0;
  }
}
