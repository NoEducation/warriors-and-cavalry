// Frames per second averaged over the most recent frame times.

export class FpsCounter {
  private readonly frameTimes: number[] = [];

  /** `sampleCount` is how many of the latest frames the reading averages over. */
  public constructor(private readonly sampleCount: number) {}

  /** Records one frame's duration in seconds; call once per frame. Durations <= 0 are ignored. */
  public addFrame(dtSeconds: number): void {
    if (dtSeconds > 0) this.frameTimes.push(dtSeconds);
    if (this.frameTimes.length > this.sampleCount) this.frameTimes.shift();
  }

  /** Mean frames per second over the recorded frames, or null before the first frame. */
  public get fps(): number | null {
    if (this.frameTimes.length === 0) return null;
    const mean = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    return 1 / mean;
  }
}
