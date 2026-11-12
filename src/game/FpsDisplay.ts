// Keeps the HUD's FPS reading up to date without touching the DOM every frame.
import type { Hud } from '../ui/Hud';
import { FpsCounter } from './FpsCounter';

export class FpsDisplay {
  private readonly counter: FpsCounter;
  private lastUpdate = 0;

  /** Shows on `hud` the mean FPS over `sampleCount` frames, refreshed at most every `updateMs` milliseconds. */
  public constructor(
    private readonly hud: Hud,
    sampleCount: number,
    private readonly updateMs: number,
  ) {
    this.counter = new FpsCounter(sampleCount);
  }

  /** Records a frame that lasted `dtSeconds` and ended at `timeMs` (the frame callback's time). Call once per frame. */
  public addFrame(dtSeconds: number, timeMs: number): void {
    this.counter.addFrame(dtSeconds);
    const fps = this.counter.fps;
    if (timeMs - this.lastUpdate < this.updateMs || fps === null) return;
    this.lastUpdate = timeMs;
    this.hud.setFps(fps);
  }
}
