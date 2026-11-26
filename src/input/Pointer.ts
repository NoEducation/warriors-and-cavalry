// Cursor position over the canvas in normalised device coordinates, plus presses, clicks, drags and lost presses on it.
import { ButtonTracker } from './ButtonTracker';
import { DragTracker } from './DragTracker';
import { type NdcPoint, ndcInBox } from './ndc';
import { PointerListeners } from './PointerListeners';

export type { PointerDrag } from './DragTracker';
export type { NdcPoint } from './ndc';

const MIDDLE_BUTTON = 1;

export class Pointer extends PointerListeners {
  private position: NdcPoint | null = null;
  private readonly tracker = new DragTracker();
  private readonly buttons = new ButtonTracker();
  /** Aborted on `dispose`, which removes every canvas event handler. */
  private readonly listening = new AbortController();

  /** Starts tracking the pointer over `canvas`; register listeners with the `on…` methods. */
  public constructor(private readonly canvas: HTMLCanvasElement) {
    super();
    const options = { signal: this.listening.signal };
    canvas.addEventListener('pointermove', this.onPointerMove, options);
    canvas.addEventListener('pointerleave', this.onPointerLeave, options);
    canvas.addEventListener('pointerdown', this.onPointerDown, options);
    canvas.addEventListener('pointerup', this.onPointerUp, options);
    canvas.addEventListener('pointercancel', this.onPressLost, options);
    canvas.addEventListener('lostpointercapture', this.onPressLost, options);
    canvas.addEventListener('mousedown', this.preventMiddleButton, options);
    canvas.addEventListener('auxclick', this.preventMiddleButton, options);
  }

  /** Current cursor position, or null while the cursor is outside the canvas. Read once per frame. */
  public get ndc(): NdcPoint | null {
    return this.position;
  }

  /** Stops tracking the pointer and drops every listener. Call when the pointer is no longer needed. */
  public dispose(): void {
    this.listening.abort();
    this.clearListeners();
    this.position = null;
    this.tracker.cancel();
    this.buttons.clear();
  }

  /** Updates the cursor position; null outside the canvas (moves are still seen there during a captured drag). */
  private updatePosition(e: PointerEvent): void {
    // The canvas is drawn at reduced resolution, so use its CSS box.
    this.position = ndcInBox(this.canvas.getBoundingClientRect(), e.clientX, e.clientY);
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    this.updatePosition(e);
    this.notifyButtonChanges(e.buttons);
    const drag = this.tracker.move(e.clientX, e.clientY);
    if (drag) this.notifyDrag(drag);
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
    this.buttons.set(e.buttons);
    this.notifyPress(e.button);
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Not an active pointer (e.g. a synthetic event): the press still works while the cursor stays on the canvas.
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    const release = this.tracker.release();
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    this.buttons.set(e.buttons);
    this.notifyRelease(e.button);
    if (release && release.button === e.button && !release.wasDrag) this.notifyClick(e.button);
  };

  /**
   * Reports each button newly held in `buttons` as pressed, and a button no longer held as a cancel: a release seen
   * only on a move may follow a lost `pointerup`, so it never counts as one.
   */
  private notifyButtonChanges(buttons: number): void {
    const { pressed, released } = this.buttons.update(buttons);
    for (const button of pressed) this.notifyPress(button);
    if (released.length === 0) return;
    if (!this.buttons.anyHeld) this.tracker.cancel();
    this.notifyCancel();
  }

  /** Forgets the press and the held buttons, reporting a cancel when a button was held. */
  private cancelPress(): void {
    this.tracker.cancel();
    if (this.buttons.clear()) this.notifyCancel();
  }

  /** `pointercancel` or lost capture. Capture is also lost after every `pointerup`, with no button held: no cancel. */
  private readonly onPressLost = (): void => this.cancelPress();

  /** Stops the browser's middle-click auto-scroll and middle-click paste/open over the canvas. */
  private readonly preventMiddleButton = (e: MouseEvent): void => {
    if (e.button === MIDDLE_BUTTON) e.preventDefault();
  };
}
