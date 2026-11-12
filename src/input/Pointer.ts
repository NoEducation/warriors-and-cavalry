// Cursor position over the canvas in normalised device coordinates, plus clicks and drags on it.
import { DragTracker, type PointerDrag } from './DragTracker';

export type { PointerDrag } from './DragTracker';

/** Normalised device coordinates: -1..1 on both axes, +y up. */
export interface NdcPoint {
  readonly x: number;
  readonly y: number;
}

const MIDDLE_BUTTON = 1;

export class Pointer {
  private position: NdcPoint | null = null;
  private readonly tracker = new DragTracker();
  private readonly clickListeners: ((button: number) => void)[] = [];
  private readonly dragListeners: ((drag: PointerDrag) => void)[] = [];

  /** Starts tracking the pointer over `canvas`. */
  public constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('lostpointercapture', this.onPointerCancel);
    canvas.addEventListener('mousedown', this.preventMiddleButton);
    canvas.addEventListener('auxclick', this.preventMiddleButton);
  }

  /** Current cursor position, or null while the cursor is outside the canvas. Read once per frame. */
  public get ndc(): NdcPoint | null {
    return this.position;
  }

  /**
   * Calls `listener` with the button (`PointerEvent.button`: 0 left, 1 middle, 2 right) whenever a button is pressed
   * and released on the canvas without moving more than a few pixels in between. Register once at setup.
   */
  public onClick(listener: (button: number) => void): void {
    this.clickListeners.push(listener);
  }

  /**
   * Calls `listener` with the movement in CSS pixels since the previous call while a button pressed on the canvas is
   * held, once the press has moved far enough to be a drag (it then produces no click). Keeps reporting when the
   * cursor leaves the canvas. Register once at setup.
   */
  public onDrag(listener: (drag: PointerDrag) => void): void {
    this.dragListeners.push(listener);
  }

  /** Stops tracking the pointer. Call when the pointer is no longer needed. */
  public dispose(): void {
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('lostpointercapture', this.onPointerCancel);
    this.canvas.removeEventListener('mousedown', this.preventMiddleButton);
    this.canvas.removeEventListener('auxclick', this.preventMiddleButton);
    this.clickListeners.length = 0;
    this.dragListeners.length = 0;
    this.position = null;
    this.tracker.cancel();
  }

  /** Updates the cursor position; null outside the canvas (moves are still seen there during a captured drag). */
  private updatePosition(e: PointerEvent): void {
    // The canvas is drawn at reduced resolution, so use its CSS box.
    const rect = this.canvas.getBoundingClientRect();
    const u = (e.clientX - rect.left) / rect.width;
    const v = (e.clientY - rect.top) / rect.height;
    this.position = u >= 0 && u <= 1 && v >= 0 && v <= 1 ? { x: u * 2 - 1, y: -v * 2 + 1 } : null;
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    this.updatePosition(e);
    const drag = this.tracker.move(e.clientX, e.clientY);
    if (drag) for (const listener of this.dragListeners) listener(drag);
  };

  /** Without pointer capture (it can fail), leaving the canvas abandons the press as before. */
  private readonly onPointerLeave = (e: PointerEvent): void => {
    this.position = null;
    if (!this.canvas.hasPointerCapture(e.pointerId)) this.tracker.cancel();
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.button === MIDDLE_BUTTON) e.preventDefault();
    this.updatePosition(e);
    this.tracker.press(e.button, e.clientX, e.clientY);
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Not an active pointer (e.g. a synthetic event): the press still works while the cursor stays on the canvas.
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    const release = this.tracker.release();
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    if (!release || release.button !== e.button || release.wasDrag) return;
    for (const listener of this.clickListeners) listener(e.button);
  };

  private readonly onPointerCancel = (): void => {
    this.tracker.cancel();
  };

  /** Stops the browser's middle-click auto-scroll and middle-click paste/open over the canvas. */
  private readonly preventMiddleButton = (e: MouseEvent): void => {
    if (e.button === MIDDLE_BUTTON) e.preventDefault();
  };
}
