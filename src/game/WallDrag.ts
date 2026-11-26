// A wall drag in progress: its start, the last tile its end was over, and its preview, reused while nothing changed.
import { ResourceKind } from '../sim/ResourceKind';
import type { TileCoord } from '../sim/TileCoord';
import type { WallLinePreview } from '../sim/WallBuilder';
import type { World } from '../sim/World';

/** A preview and what it was computed from; the same inputs give an equal preview. */
interface CachedPreview {
  readonly preview: WallLinePreview;
  readonly world: World;
  readonly end: TileCoord;
  readonly objectCount: number;
  readonly stone: number;
}

export class WallDrag {
  private lastEnd: TileCoord | null = null;
  private cached: CachedPreview | null = null;

  /** A drag started on tile `start`. */
  public constructor(public readonly start: TileCoord) {}

  /** Where the line ends: the last tile `previewTo` saw, else the start. */
  public get end(): TileCoord {
    return this.lastEnd ?? this.start;
  }

  /**
   * What the line from the start to `tile` (null: to `end`) would build in `world`. Returns the same object as the
   * previous call while the end tile, the world's object count and its stone stay the same. Call per frame.
   */
  public previewTo(world: World, tile: TileCoord | null): WallLinePreview {
    if (tile && (tile.tx !== this.end.tx || tile.ty !== this.end.ty)) this.lastEnd = { tx: tile.tx, ty: tile.ty };
    if (this.cached && this.isCurrent(this.cached, world)) return this.cached.preview;
    const preview = world.previewWallLine(this.start, this.end);
    const stone = world.economy.amount(ResourceKind.Stone);
    this.cached = { preview, world, end: this.end, objectCount: world.objectCount, stone };
    return preview;
  }

  /** Whether `cached` was computed for `world` as it is now and for the current end tile. */
  private isCurrent(cached: CachedPreview, world: World): boolean {
    return (
      cached.world === world &&
      cached.end === this.end &&
      cached.objectCount === world.objectCount &&
      cached.stone === world.economy.amount(ResourceKind.Stone)
    );
  }
}
