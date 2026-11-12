// Cursor position over the canvas in normalised device coordinates.

/** Normalised device coordinates: -1..1 on both axes, +y up. */
export interface NdcPoint {
  readonly x: number;
  readonly y: number;
}

export class Pointer {
  private position: NdcPoint | null = null;

  /** Starts tracking the pointer over `canvas`. */
  public constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
  }

  /** Current cursor position, or null while the cursor is outside the canvas. Read once per frame. */
  public get ndc(): NdcPoint | null {
    return this.position;
  }

  /** Stops tracking the pointer. Call when the pointer is no longer needed. */
  public dispose(): void {
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.position = null;
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
  };
}
