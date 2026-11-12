// HTML overlay: seed, hovered tile, FPS, a message line and a "New map" button.
import type { TileCoord } from '../sim/TileCoord';

/** What the HUD shows about the hovered tile. */
export interface HudTileInfo extends TileCoord {
  readonly name: string;
  readonly height: number;
  /** Name of the object standing on the tile, if any. */
  readonly objectName?: string;
}

export class Hud {
  private readonly seedLine: HTMLDivElement;
  private readonly tileLine: HTMLDivElement;
  private readonly fpsLine: HTMLDivElement;
  private readonly messageLine: HTMLDivElement;
  private messageTimer: ReturnType<typeof setTimeout> | null = null;

  /** Builds the HUD inside `root`; `onNewMap` runs when the player clicks "New map". */
  public constructor(
    private readonly root: HTMLElement,
    onNewMap: () => void,
  ) {
    this.seedLine = this.addLine();
    this.tileLine = this.addLine();
    this.fpsLine = this.addLine();
    this.messageLine = this.addLine();

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
    let text = 'Tile: —';
    if (info) {
      text = `Tile: ${info.tx}, ${info.ty} ${info.name} h=${info.height.toFixed(1)}`;
      if (info.objectName) text += ` — ${info.objectName}`;
    }
    if (this.tileLine.textContent !== text) this.tileLine.textContent = text;
  }

  /** Shows `text` on a message line for `seconds`, replacing any message still shown. Call for player feedback. */
  public showMessage(text: string, seconds: number): void {
    if (this.messageTimer !== null) clearTimeout(this.messageTimer);
    this.messageLine.textContent = text;
    this.messageTimer = setTimeout(() => {
      this.messageLine.textContent = '';
      this.messageTimer = null;
    }, seconds * 1000);
  }

  /** Shows the frame rate, rounded. Call a few times per second. */
  public setFps(fps: number): void {
    this.fpsLine.textContent = `FPS: ${Math.round(fps)}`;
  }

  private addLine(): HTMLDivElement {
    return this.root.appendChild(document.createElement('div'));
  }
}
