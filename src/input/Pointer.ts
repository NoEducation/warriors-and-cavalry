// Cursor position over the canvas in normalised device coordinates, plus clicks and drags on it.
import { DragTracker, type PointerDrag } from './DragTracker';

export type { PointerDrag } from './DragTracker';

/** Normalised device coordinates: -1..1 on both axes, +y up. */
export interface NdcPoint {
  readonly x: number;
  readonly y: number;
}

const MIDDLE_BUTTON = 1;
/** Each `PointerEvent.button` reported by press and release (left, middle, right) with its `buttons` bit. */
const BUTTON_BITS: readonly (readonly [button: number, bit: number])[] = [[0, 1], [1, 4], [2, 2]];

export class Pointer {
  private position: NdcPoint | null = null;
  private readonly tracker = new DragTracker();
  /** `PointerEvent.buttons` as last seen: a button pressed or let go while another is held arrives only as a move. */
  private heldButtons = 0;
  private readonly pressListeners: ((button: number) => void)[] = [];
  private readonly releaseListeners: ((button: number) => void)[] = [];
  private readonly clickListeners: ((button: number) => void)[] = [];
  private readonly dragListeners: ((drag: PointerDrag) => void)[] = [];
  private readonly cancelListeners: (() => void)[] = [];

  /** Starts tracking the pointer over `canvas`. */
  public constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('lostpointercapture', this.onLostCapture);
    canvas.addEventListener('mousedown', this.preventMiddleButton);
    canvas.addEventListener('auxclick', this.preventMiddleButton);
  }

  /** Current cursor position, or null while the cursor is outside the canvas. Read once per frame. */
  public get ndc(): NdcPoint | null {
    return this.position;
  }

  /**
   * Calls `listener` with the button (`PointerEvent.button`: 0 left, 1 middle, 2 right) whenever a button is pressed on
   * the canvas, also a second button pressed while another is held. Register once at setup.
   */
  public onPress(listener: (button: number) => void): void {
    this.pressListeners.push(listener);
  }

  /**
   * Calls `listener` with the button whenever a button pressed on the canvas is let go, also outside the canvas while
   * the pointer is captured. Fires before any `onClick` for the same release. Register once at setup.
   */
  public onRelease(listener: (button: number) => void): void {
    this.releaseListeners.push(listener);
  }

  /**
   * Calls `listener` with the button whenever a button is pressed and released on the canvas without moving more
   * than a few pixels in between. Register once at setup.
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

  /**
   * Calls `listener` whenever a held button is lost without a release on the canvas: `pointercancel`, pointer capture
   * lost while a button is held, leaving the canvas with a button held and no capture, or a button found let go only on
   * a later move (its release is never reported). Register once at setup.
   */
  public onCancel(listener: () => void): void {
    this.cancelListeners.push(listener);
  }

  /** Stops tracking the pointer. Call when the pointer is no longer needed. */
  public dispose(): void {
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('lostpointercapture', this.onLostCapture);
    this.canvas.removeEventListener('mousedown', this.preventMiddleButton);
    this.canvas.removeEventListener('auxclick', this.preventMiddleButton);
    this.pressListeners.length = 0;
    this.releaseListeners.length = 0;
    this.clickListeners.length = 0;
    this.dragListeners.length = 0;
    this.cancelListeners.length = 0;
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
    this.notifyButtonChanges(e.buttons);
    const drag = this.tracker.move(e.clientX, e.clientY);
    if (drag) for (const listener of this.dragListeners) listener(drag);
  };

  /** Without pointer capture (it can fail), leaving the canvas abandons the press. */
  private readonly onPointerLeave = (e: PointerEvent): void => {
    this.position = null;
    if (!this.canvas.hasPointerCapture(e.pointerId)) this.cancelPress();
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.button === MIDDLE_BUTTON) e.preventDefault();
    this.updatePosition(e);
    this.tracker.press(e.button, e.clientX, e.clientY);
    this.heldButtons = e.buttons;
    this.notify(this.pressListeners, e.button);
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Not an active pointer (e.g. a synthetic event): the press still works while the cursor stays on the canvas.
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    const release = this.tracker.release();
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    this.heldButtons = e.buttons;
    this.notify(this.releaseListeners, e.button);
    if (!release || release.button !== e.button || release.wasDrag) return;
    this.notify(this.clickListeners, e.button);
  };

  /**
   * Reports each button newly held in `buttons` as pressed, and a button no longer held as a cancel: a release seen
   * only on a move may be a lost `pointerup`, so it never counts as one.
   */
  private notifyButtonChanges(buttons: number): void {
    const changed = this.heldButtons ^ buttons;
    const released = changed & this.heldButtons;
    this.heldButtons = buttons;
    for (const [button, bit] of BUTTON_BITS) if (changed & bit & buttons) this.notify(this.pressListeners, button);
    if (buttons === 0 && released) this.tracker.cancel();
    if (released) for (const listener of this.cancelListeners) listener();
  }

  private notify(listeners: readonly ((button: number) => void)[], button: number): void {
    for (const listener of listeners) listener(button);
  }

  /** Forgets the press and the held buttons, reporting a cancel when a button was held. */
  private cancelPress(): void {
    const wasHeld = this.heldButtons !== 0;
    this.tracker.cancel();
    this.heldButtons = 0;
    if (wasHeld) for (const listener of this.cancelListeners) listener();
  }

  private readonly onPointerCancel = (): void => this.cancelPress();

  /** Capture is also lost after every `pointerup`; only a loss while a button is still held is a cancel. */
  private readonly onLostCapture = (): void => this.cancelPress();

  /** Stops the browser's middle-click auto-scroll and middle-click paste/open over the canvas. */
  private readonly preventMiddleButton = (e: MouseEvent): void => {
    if (e.button === MIDDLE_BUTTON) e.preventDefault();
  };
}

