// HTML overlay: seed, hovered tile, FPS and a "New map" button.

export interface TileInfo {
  tx: number;
  ty: number;
  name: string;
  height: number;
}

export interface Hud {
  setSeed(seed: number): void;
  setTile(info: TileInfo | null): void;
  setFps(fps: number): void;
}

export function createHud(root: HTMLElement, onNewMap: () => void): Hud {
  const line = (): HTMLDivElement => root.appendChild(document.createElement('div'));
  const seedLine = line();
  const tileLine = line();
  const fpsLine = line();

  const button = root.appendChild(document.createElement('button'));
  button.type = 'button';
  button.textContent = 'New map';
  button.addEventListener('click', () => {
    // Drop focus so Space/Enter while moving the camera does not press the button again.
    button.blur();
    onNewMap();
  });

  tileLine.textContent = 'Tile: —';
  fpsLine.textContent = 'FPS: —';

  return {
    setSeed(seed) {
      seedLine.textContent = `Seed: ${seed}`;
    },
    setTile(info) {
      // Called every frame: only touch the DOM when the text changes.
      const text = info ? `Tile: ${info.tx}, ${info.ty} ${info.name} h=${info.height.toFixed(1)}` : 'Tile: —';
      if (tileLine.textContent !== text) tileLine.textContent = text;
    },
    setFps(fps) {
      fpsLine.textContent = `FPS: ${Math.round(fps)}`;
    },
  };
}
