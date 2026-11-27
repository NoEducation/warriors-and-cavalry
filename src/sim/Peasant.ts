// One peasant: its state and every change to it, each a named transition.
import { POPULATION_CONFIG } from './populationConfig';
import type { TileCoord } from './TileCoord';
import type { Load, PeasantState, PeasantView } from './PeasantView';
import { WalkMode } from './walkRules';

const NO_TILES: readonly TileCoord[] = Object.freeze([]);

/**
 * The mutable peasant record. Its fields change only through the transitions below, which `Population` and its
 * helpers call; everyone else sees it as a `PeasantView`.
 */
export class Peasant implements PeasantView {
  private _state: PeasantState = 'toWork';
  private _tx: number;
  private _ty: number;
  private _nextTx: number;
  private _nextTy: number;
  private _stepProgress = 0;
  private _stepTicks = 0;
  private _load: Load | null = null;
  private _targetId: number | null = null;
  private _treeId: number | null = null;
  private _waitTicks = 0;
  private _path = NO_TILES;
  private _pathIndex = 0;
  private _walkMode: WalkMode = WalkMode.Ground;

  /** A new worker standing on tile (tx, ty), heading for its workplace, building `workplaceId`. */
  public constructor(
    public readonly id: number,
    tx: number,
    ty: number,
    private readonly _workplaceId: number,
  ) {
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
  public get workplaceId(): number { return this._workplaceId; }
  public get targetId(): number | null { return this._targetId; }
  public get treeId(): number | null { return this._treeId; }
  public get waitTicks(): number { return this._waitTicks; }
  public get path(): readonly TileCoord[] { return this._path; }
  public get pathIndex(): number { return this._pathIndex; }
  public get walkMode(): WalkMode { return this._walkMode; }

  /** toWork or toWorkBack -> working: stands at its workplace, so the building's production advances. */
  public startWorking(): void {
    this._state = 'working';
  }

  /** -> toTree: a woodcutter heads for the tree `treeId`, which it has claimed. */
  public headToTree(treeId: number): void {
    this._treeId = treeId;
    this._state = 'toTree';
  }

  /** toTree -> chopping: stands next to its tree, so its hut's production advances. */
  public startChopping(): void {
    this._state = 'chopping';
  }

  /** Forgets its tree (gone, or about to be replaced by another); the state is unchanged. */
  public dropTree(): void {
    this._treeId = null;
  }

  /** -> working: a woodcutter with no tree to fell stands at its hut and looks again after a retry wait. */
  public waitAtWork(): void {
    this._state = 'working';
    this.waitToRetry();
  }

  /** -> toTree: a woodcutter whose free trees are all out of reach waits where it is, then looks again. */
  public waitForTree(): void {
    this._treeId = null;
    this._state = 'toTree';
    this.waitToRetry();
  }

  /** working or chopping -> toStore: takes its building's finished batch to carry to storage, forgetting its tree. */
  public pickUp(load: Load): void {
    this._load = load;
    this._treeId = null;
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

  /** After a failed search: waits `retryTicks` plus `id % retrySpread` ticks before searching again. */
  public waitToRetry(): void {
    this._waitTicks = POPULATION_CONFIG.retryTicks + (this.id % POPULATION_CONFIG.retrySpread);
  }

  /** Counts a wait down by one tick; true when the wait has just ended. Call only while waiting. */
  public countDownWait(): boolean {
    return --this._waitTicks === 0;
  }

  /** Replaces the current walk with `path` (empty to stop after the current step), walked in `mode`. */
  public startWalk(path: readonly TileCoord[], mode: WalkMode = WalkMode.Ground): void {
    this._path = path;
    this._pathIndex = 0;
    this._walkMode = mode;
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
