// Decides whether a mouse press is a click or a drag, and turns drag movement into per-event deltas. No DOM needed.

/** Movement of the pointer, in CSS pixels since the previous reported drag, while `button` is held. */
export interface PointerDrag {
  readonly button: number;
  readonly dx: number;
  readonly dy: number;
}

/** How a press ended: which button, and whether it moved far enough to count as a drag instead of a click. */
export interface PressRelease {
  readonly button: number;
  readonly wasDrag: boolean;
}

/** A press that moves more than this many CSS pixels away from where it started is a drag, not a click. */
export const DRAG_THRESHOLD_PX = 4;

export class DragTracker {
  /** Button currently held, or null. Only one press is tracked at a time. */
  private button: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private dragging = false;

  /** Starts tracking a press of `button` at (x, y). Ignored while another press is tracked. Call on pointerdown. */
  public press(button: number, x: number, y: number): void {
    if (this.button !== null) return;
    this.button = button;
    this.lastX = x;
    this.lastY = y;
    this.dragging = false;
  }

  /**
   * Feeds a pointer position. Returns the movement since the last reported drag once the press has moved more than
   * DRAG_THRESHOLD_PX from where it started (the first report covers the whole movement since the press); returns null
   * before that, without a press, or for non-finite positions. Call on pointermove.
   */
  public move(x: number, y: number): PointerDrag | null {
    if (this.button === null || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    if (!this.dragging) {
      if (Math.hypot(dx, dy) <= DRAG_THRESHOLD_PX) return null;
      this.dragging = true;
    }
    this.lastX = x;
    this.lastY = y;
    return { button: this.button, dx, dy };
  }

  /** Ends the tracked press and says whether it was a drag; null if nothing was pressed. Call on pointerup. */
  public release(): PressRelease | null {
    if (this.button === null) return null;
    const result: PressRelease = { button: this.button, wasDrag: this.dragging };
    this.cancel();
    return result;
  }

  /** Forgets the tracked press without reporting it. Call on pointercancel or when the press is lost. */
  public cancel(): void {
    this.button = null;
    this.dragging = false;
  }
}
