// The rectangle of tiles an object covers, and the questions every footprint user asks about it.
import type { GameMap } from './GameMap';
import { OBJECT_KINDS, type ObjectKind } from './ObjectKind';
import type { TileCoord } from './TileCoord';

/** Lowest and highest corner height in an area. */
export interface HeightRange {
  readonly min: number;
  readonly max: number;
}

export class Footprint {
  /** `width` x `height` tiles starting at tile (tx, ty). */
  public constructor(
    public readonly tx: number,
    public readonly ty: number,
    public readonly width: number,
    public readonly height: number,
  ) {}

  /** The footprint of an object of `kind` anchored at tile (tx, ty). Throws a RangeError for an unknown kind. */
  public static of(kind: ObjectKind, tx: number, ty: number): Footprint {
    const info = OBJECT_KINDS[kind];
    if (!info) throw new RangeError(`unknown object kind ${kind}`);
    return new Footprint(tx, ty, info.width, info.height);
  }

  /** True when the anchor is an integer tile and every tile lies inside `map`. Check before indexing tiles. */
  public inBounds(map: GameMap): boolean {
    return map.inBounds(this.tx, this.ty) && map.inBounds(this.tx + this.width - 1, this.ty + this.height - 1);
  }

  /** Every tile of the footprint, row by row. */
  public *tiles(): Iterable<TileCoord> {
    for (let ty = this.ty; ty < this.ty + this.height; ty++) {
      for (let tx = this.tx; tx < this.tx + this.width; tx++) yield { tx, ty };
    }
  }

  /** Lowest and highest height among the footprint's corners inside `map`; null when no corner is inside. */
  public cornerHeightRange(map: GameMap): HeightRange | null {
    let min = Infinity;
    let max = -Infinity;
    for (let cy = this.ty; cy <= this.ty + this.height; cy++) {
      for (let cx = this.tx; cx <= this.tx + this.width; cx++) {
        if (!Footprint.cornerInMap(map, cx, cy)) continue;
        const h = map.heightAt(cx, cy);
        min = Math.min(min, h);
        max = Math.max(max, h);
      }
    }
    return min <= max ? { min, max } : null;
  }

  private static cornerInMap(map: GameMap, cx: number, cy: number): boolean {
    return Number.isInteger(cx) && Number.isInteger(cy) && cx >= 0 && cy >= 0 && cx <= map.width && cy <= map.height;
  }
}
