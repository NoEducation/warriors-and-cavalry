// Connects the cursor to the tile under it: placement ghost, footprint highlight and HUD tile line.
import type * as THREE from 'three';
import type { Pointer } from '../input/Pointer';
import type { PlacementGhost } from '../render/PlacementGhost';
import type { TileHighlight } from '../render/TileHighlight';
import type { TilePicker } from '../render/TilePicker';
import type { GameMap } from '../sim/GameMap';
import { OBJECT_KINDS } from '../sim/ObjectKind';
import type { TileCoord } from '../sim/TileCoord';
import { TILE_NAMES } from '../sim/tiles';
import type { World } from '../sim/World';
import type { Hud } from '../ui/Hud';
import type { BuildController } from './BuildController';

export class TileHover {
  /** Uses the given pointer, picker, highlight, ghost, HUD and build controller; owns none of them. */
  public constructor(
    private readonly pointer: Pointer,
    private readonly picker: TilePicker,
    private readonly highlight: TileHighlight,
    private readonly ghost: PlacementGhost,
    private readonly hud: Hud,
    private readonly builder: BuildController,
  ) {}

  /** The tile under the cursor right now, or null. Call when handling a click. */
  public tileUnderCursor(camera: THREE.Camera, map: GameMap): TileCoord | null {
    const cursor = this.pointer.ndc;
    return cursor ? this.picker.pick(cursor, camera, map) : null;
  }

  /**
   * Finds the hovered tile and updates the ghost, the highlight (placement footprint, hovered object's footprint or the
   * single tile) and the HUD tile line. Call once per frame.
   */
  public update(camera: THREE.Camera, world: World): void {
    const { map } = world;
    const tile = this.tileUnderCursor(camera, map);
    const preview = this.builder.preview(tile);
    if (preview) {
      const info = OBJECT_KINDS[preview.kind];
      this.ghost.show(world, preview);
      this.highlight.showFootprint(map, preview.tx, preview.ty, info.width, info.height);
    } else {
      this.ghost.hide();
    }
    if (!tile) {
      this.highlight.hide();
      this.hud.setTile(null);
      return;
    }
    const object = world.objectAt(tile.tx, tile.ty);
    const objectInfo = object ? OBJECT_KINDS[object.kind] : undefined;
    if (!preview) {
      if (object && objectInfo) {
        this.highlight.showFootprint(map, object.tx, object.ty, objectInfo.width, objectInfo.height);
      } else {
        this.highlight.showTile(map, tile.tx, tile.ty);
      }
    }
    const type = map.tileAt(tile.tx, tile.ty);
    const name = type === undefined ? '?' : TILE_NAMES[type];
    this.hud.setTile({ ...tile, name, height: map.tileHeight(tile.tx, tile.ty), objectName: objectInfo?.name });
  }
}
