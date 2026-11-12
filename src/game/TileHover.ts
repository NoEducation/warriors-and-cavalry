// Connects the cursor to the tile under it: highlights the tile and shows it in the HUD.
import type * as THREE from 'three';
import type { Pointer } from '../input/Pointer';
import type { TileHighlight } from '../render/TileHighlight';
import type { TilePicker } from '../render/TilePicker';
import type { GameMap } from '../sim/GameMap';
import type { TileCoord } from '../sim/TileCoord';
import { TILE_NAMES } from '../sim/tiles';
import type { Hud } from '../ui/Hud';

export class TileHover {
  /** Uses the given pointer, picker, highlight and HUD; owns none of them. */
  public constructor(
    private readonly pointer: Pointer,
    private readonly picker: TilePicker,
    private readonly highlight: TileHighlight,
    private readonly hud: Hud,
  ) {}

  /** Finds the hovered tile, updates the highlight and HUD, and returns the tile (or null). Call once per frame. */
  public update(camera: THREE.Camera, map: GameMap): TileCoord | null {
    const cursor = this.pointer.ndc;
    const tile = cursor ? this.picker.pick(cursor, camera, map) : null;
    if (!tile) {
      this.highlight.hide();
      this.hud.setTile(null);
      return null;
    }
    this.highlight.showTile(map, tile.tx, tile.ty);
    const type = map.tileAt(tile.tx, tile.ty);
    const name = type === undefined ? '?' : TILE_NAMES[type];
    this.hud.setTile({ ...tile, name, height: map.tileHeight(tile.tx, tile.ty) });
    return tile;
  }
}
