// Where a raider wave appears: a seeded direction from the Keep, at a fixed distance, on ground from which raiders
// can get to the Keep (breaking through what stands in the way).
import type { ArmyHost } from './ArmyHost';
import type { Breach } from './Breach';
import { COMBAT_CONFIG } from './combatConfig';
import type { MapObject } from './MapObject';
import { OBJECT_KINDS } from './ObjectKind';
import { hash2 } from './rng';
import type { TileCoord } from './TileCoord';
import { WalkClass, type WalkClassOf } from './walkRules';

/** The 8 compass directions in the order N, NE, E, SE, S, SW, W, NW (y grows southward). */
const DIRECTIONS: readonly (readonly [number, number])[] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
/** Rings searched round the aimed-at point for ground to appear on. */
const SEARCH_RINGS = 16;

export class RaidSpawner {
  /** Places waves in `world`, raiders walking over `raiderClass`, their way checked with `breach`. */
  public constructor(
    private readonly world: ArmyHost,
    private readonly raiderClass: WalkClassOf,
    private readonly breach: Breach,
  ) {}

  /**
   * Where wave `wave` against `keep` appears: aimed `spawnDistance` tiles from the Keep's centre in the direction
   * `floor(hash2(seed, wave, 0) * 8)` (clamped into the map), the nearest raider ground tile to that point ring by
   * ring, if raiders can get from it to the Keep; else the same for the next direction. Null when no direction has one.
   */
  public tileFor(keep: MapObject, wave: number): TileCoord | null {
    const { width, height } = OBJECT_KINDS[keep.kind];
    const cx = keep.tx + Math.floor(width / 2);
    const cy = keep.ty + Math.floor(height / 2);
    const first = Math.floor(hash2(this.world.map.seed, wave, 0) * DIRECTIONS.length);
    for (let i = 0; i < DIRECTIONS.length; i++) {
      const [dx, dy] = DIRECTIONS[(first + i) % DIRECTIONS.length];
      const x = this.clamp(cx + dx * COMBAT_CONFIG.spawnDistance, this.world.map.width);
      const y = this.clamp(cy + dy * COMBAT_CONFIG.spawnDistance, this.world.map.height);
      const tile = this.groundNear(x, y);
      if (tile && this.breach.reaches(tile, keep)) return tile;
    }
    return null;
  }

  /** The first raider ground tile on the rings round (x, y), each ring row by row; null within `SEARCH_RINGS`. */
  private groundNear(x: number, y: number): TileCoord | null {
    for (let r = 0; r <= SEARCH_RINGS; r++) {
      for (let ty = y - r; ty <= y + r; ty++) {
        for (let tx = x - r; tx <= x + r; tx++) {
          if (Math.max(Math.abs(tx - x), Math.abs(ty - y)) !== r) continue;
          if (this.raiderClass(tx, ty) === WalkClass.Ground) return { tx, ty };
        }
      }
    }
    return null;
  }

  private clamp(value: number, size: number): number {
    return Math.max(0, Math.min(size - 1, value));
  }
}
