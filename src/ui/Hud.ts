// HTML overlay: seed, hovered tile, FPS and a "New map" button.
import type { TileCoord } from '../sim/TileCoord';

/** What the HUD shows about the hovered tile. */
export interface HudTileInfo extends TileCoord {
  readonly name: string;
  readonly height: number;
}

export class Hud {
  private readonly seedLine: HTMLDivElement;
  private readonly tileLine: HTMLDivElement;
  private readonly fpsLine: HTMLDivElement;

  /** Builds the HUD inside `root`; `onNewMap` runs when the player clicks "New map". */
  public constructor(
    private readonly root: HTMLElement,
    onNewMap: () => void,
  ) {
    this.seedLine = this.addLine();
    this.tileLine = this.addLine();
    this.fpsLine = this.addLine();

    const button = root.appendChild(document.createElement('button'));
    button.type = 'button';
    button.textContent = 'New map';
    button.addEventListener('click', () => {
      // Drop focus so Space/Enter while moving the camera does not press the button again.
      button.blur();
      onNewMap();
    });

    this.tileLine.textContent = 'Tile: —';
    this.fpsLine.textContent = 'FPS: —';
  }

  /** Shows the seed of the current map. Call after each map load. */
  public setSeed(seed: number): void {
    this.seedLine.textContent = `Seed: ${seed}`;
  }

  /** Shows the hovered tile, or a dash for null. Cheap to call every frame. */
  public setTile(info: HudTileInfo | null): void {
    // Called every frame: only touch the DOM when the text changes.
    const text = info ? `Tile: ${info.tx}, ${info.ty} ${info.name} h=${info.height.toFixed(1)}` : 'Tile: —';
    if (this.tileLine.textContent !== text) this.tileLine.textContent = text;
  }

  /** Shows the frame rate, rounded. Call a few times per second. */
  public setFps(fps: number): void {
    this.fpsLine.textContent = `FPS: ${Math.round(fps)}`;
  }

  private addLine(): HTMLDivElement {
    return this.root.appendChild(document.createElement('div'));
  }
}
