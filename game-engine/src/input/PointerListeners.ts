// Who listens to the pointer: the press, release, click, drag and cancel callbacks `Pointer` reports to.
import type { PointerDrag } from './DragTracker';

export class PointerListeners {
  private readonly pressListeners: ((button: number) => void)[] = [];
  private readonly releaseListeners: ((button: number) => void)[] = [];
  private readonly clickListeners: ((button: number) => void)[] = [];
  private readonly dragListeners: ((drag: PointerDrag) => void)[] = [];
  private readonly cancelListeners: (() => void)[] = [];

  /**
   * Calls `listener` with the button (`PointerEvent.button`: 0 left, 1 middle, 2 right) whenever a button is pressed on
   * the canvas, also a second button pressed while another is held. Register once at setup.
   */
  public onPress(listener: (button: number) => void): void {
    this.pressListeners.push(listener);
  }

  /**
   * Calls `listener` with the button whenever a button pressed on the canvas is let go (a `pointerup`), also outside
   * the canvas while the pointer is captured. Fires before any `onClick` for the same release. Register once at setup.
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
   * lost while a button is held, leaving the canvas with a button held and no capture, or a button found let go only
   * on a later move (its release is never reported). Register once at setup.
   */
  public onCancel(listener: () => void): void {
    this.cancelListeners.push(listener);
  }

  // The notify methods call each listener of their kind in registration order; `Pointer` calls them.
  protected notifyPress(button: number): void {
    for (const listener of this.pressListeners) listener(button);
  }

  protected notifyRelease(button: number): void {
    for (const listener of this.releaseListeners) listener(button);
  }

  protected notifyClick(button: number): void {
    for (const listener of this.clickListeners) listener(button);
  }

  protected notifyDrag(drag: PointerDrag): void {
    for (const listener of this.dragListeners) listener(drag);
  }

  protected notifyCancel(): void {
    for (const listener of this.cancelListeners) listener();
  }

  /** Drops every listener. */
  protected clearListeners(): void {
    this.pressListeners.length = 0;
    this.releaseListeners.length = 0;
    this.clickListeners.length = 0;
    this.dragListeners.length = 0;
    this.cancelListeners.length = 0;
  }
}
