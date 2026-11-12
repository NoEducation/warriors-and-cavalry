// Cursor position over the canvas in normalised device coordinates, and clicks on it.

/** Normalised device coordinates: -1..1 on both axes, +y up. */
export interface NdcPoint {
  readonly x: number;
  readonly y: number;
}

export class Pointer {
  private position: NdcPoint | null = null;
  /** Button pressed on the canvas and not yet released or dragged out, or null. */
  private pressedButton: number | null = null;
  private readonly clickListeners: ((button: number) => void)[] = [];

  /** Starts tracking the pointer over `canvas`. */
  public constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerLeave);
  }

  /** Current cursor position, or null while the cursor is outside the canvas. Read once per frame. */
  public get ndc(): NdcPoint | null {
    return this.position;
  }

  /**
   * Calls `listener` with the button (`PointerEvent.button`: 0 left, 2 right) whenever a button is pressed and released
   * on the canvas without the cursor leaving it in between. Register once at setup.
   */
  public onClick(listener: (button: number) => void): void {
    this.clickListeners.push(listener);
  }

  /** Stops tracking the pointer. Call when the pointer is no longer needed. */
  public dispose(): void {
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerLeave);
    this.clickListeners.length = 0;
    this.position = null;
    this.pressedButton = null;
  }

  // The canvas is drawn at reduced resolution, so use its CSS box.
  private readonly onPointerMove = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.position = {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
    };
  };

  private readonly onPointerLeave = (): void => {
    this.position = null;
    this.pressedButton = null;
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.onPointerMove(e);
    this.pressedButton = e.button;
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (this.pressedButton !== e.button) return;
    this.pressedButton = null;
    for (const listener of this.clickListeners) listener(e.button);
  };
}
