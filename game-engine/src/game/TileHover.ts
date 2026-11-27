// Connects the cursor to the tile under it: placement or wall-line ghost, footprint highlight and HUD lines.
import type * as THREE from 'three';
import type { Pointer } from '../input/Pointer';
import type { PlacementGhost } from '../render/PlacementGhost';
import type { TileHighlight } from '../render/TileHighlight';
import type { TilePicker } from '../render/TilePicker';
import type { WallLineGhost } from '../render/WallLineGhost';
import { Footprint } from '../sim/Footprint';
import type { GameMap } from '../sim/GameMap';
import { OBJECT_KINDS } from '../sim/ObjectKind';
import type { PlacementPreview } from '../sim/PlacementPreview';
import type { TileCoord } from '../sim/TileCoord';
import { TILE_NAMES } from '../sim/tiles';
import type { WallLinePreview } from '../sim/WallBuilder';
import type { World } from '../sim/World';
import { wallLineText } from '../ui/costText';
import type { Hud } from '../ui/Hud';
import { productionStatusText } from '../ui/statusText';
import type { BuildController } from './BuildController';

export class TileHover {
  /** The wall line the ghost and the message line show now; an identical preview needs no redraw. */
  private shownWallLine: WallLinePreview | null = null;

  /** Uses the given pointer, picker, highlight, ghosts, HUD and build controller; owns none of them. */
  public constructor(
    private readonly pointer: Pointer,
    private readonly picker: TilePicker,
    private readonly highlight: TileHighlight,
    private readonly ghost: PlacementGhost,
    private readonly wallGhost: WallLineGhost,
    private readonly hud: Hud,
    private readonly builder: BuildController,
  ) {}

  /** The tile under the cursor right now, or null. Call when handling a click. */
  public tileUnderCursor(camera: THREE.Camera, map: GameMap): TileCoord | null {
    const cursor = this.pointer.ndc;
    return cursor ? this.picker.pick(cursor, camera, map) : null;
  }

  /**
   * Finds the tile hovered in `world` and updates the ghosts, the highlight, the HUD tile line and, while a wall is
   * dragged, its cost on the message line. Call once per frame.
   */
  public update(camera: THREE.Camera, world: World): void {
    const tile = this.tileUnderCursor(camera, world.map);
    if (this.builder.isWallDragging) this.updateWallDrag(world, tile);
    else this.updatePlacement(world, tile);
    this.updateHudLine(world, tile);
  }

  /** While a wall is dragged: its line ghost and cost; no building ghost, and the hovered tile or object outlined. */
  private updateWallDrag(world: World, tile: TileCoord | null): void {
    this.ghost.hide();
    this.showWallLine(world, this.builder.wallDragPreview(world, tile));
    this.updateHighlight(world, tile, null);
  }

  /** Otherwise: the ghost of the building about to be placed, if any, and its footprint outlined. */
  private updatePlacement(world: World, tile: TileCoord | null): void {
    const preview = this.builder.preview(world, tile);
    if (preview) this.ghost.show(world, preview);
    else this.ghost.hide();
    this.showWallLine(world, null);
    this.updateHighlight(world, tile, preview);
  }

  /** Draws the wall line's ghost and cost, or hides them for null; skipped while the preview is the one shown. */
  private showWallLine(world: World, wallLine: WallLinePreview | null): void {
    if (wallLine === this.shownWallLine) return;
    this.shownWallLine = wallLine;
    if (wallLine) this.wallGhost.show(world, wallLine);
    else this.wallGhost.hide();
    this.hud.setLiveMessage(wallLine ? wallLineText(wallLine.placedCount, wallLine.cost) : null);
  }

  /** Outlines the placement footprint, else the hovered object's footprint, else the hovered tile. */
  private updateHighlight(world: World, tile: TileCoord | null, preview: PlacementPreview | null): void {
    if (!tile) {
      this.highlight.hide();
      return;
    }
    this.highlight.showFootprint(world.map, this.highlightedFootprint(world, tile, preview));
  }

  private highlightedFootprint(world: World, tile: TileCoord, preview: PlacementPreview | null): Footprint {
    if (preview) return Footprint.of(preview.kind, preview.tx, preview.ty);
    const object = world.objectAt(tile.tx, tile.ty);
    if (object) return Footprint.of(object.kind, object.tx, object.ty);
    return new Footprint(tile.tx, tile.ty, 1, 1);
  }

  /** Shows the hovered tile's position, terrain, height, object and its production state on the HUD, or a dash. */
  private updateHudLine(world: World, tile: TileCoord | null): void {
    if (!tile) {
      this.hud.setTile(null);
      return;
    }
    const { map } = world;
    const object = world.objectAt(tile.tx, tile.ty);
    const type = map.tileAt(tile.tx, tile.ty);
    const name = type === undefined ? '?' : TILE_NAMES[type];
    const objectName = object ? OBJECT_KINDS[object.kind].name : undefined;
    const production = object ? world.productionState(object.id) : null;
    const objectState = production ? productionStatusText(production.status) : undefined;
    this.hud.setTile({ ...tile, name, height: map.tileHeight(tile.tx, tile.ty), objectName, objectState });
  }
}
