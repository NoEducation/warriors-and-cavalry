// Which mouse buttons are held, from `PointerEvent.buttons`, and which changed since the last look. No DOM needed.

/** Buttons (`PointerEvent.button`: 0 left, 1 middle, 2 right) newly held and let go, in left, middle, right order. */
export interface ButtonChanges {
  readonly pressed: readonly number[];
  readonly released: readonly number[];
}

/** Each `PointerEvent.button` (left, middle, right) with its `PointerEvent.buttons` bit. */
const BUTTON_BITS: readonly (readonly [button: number, bit: number])[] = [[0, 1], [1, 4], [2, 2]];
const NO_CHANGES: ButtonChanges = Object.freeze({ pressed: [], released: [] });

export class ButtonTracker {
  /** `PointerEvent.buttons` as last seen: a button pressed or let go while another is held arrives only as a move. */
  private held = 0;

  /** True while any button is held. */
  public get anyHeld(): boolean {
    return this.held !== 0;
  }

  /** Records `buttons` from a pointerdown or pointerup, which report their own button, without comparing. */
  public set(buttons: number): void {
    this.held = buttons;
  }

  /** Records `buttons` from a pointermove; returns what changed since the last mask, allocation-free if nothing did. */
  public update(buttons: number): ButtonChanges {
    const changed = this.held ^ buttons;
    this.held = buttons;
    if (changed === 0) return NO_CHANGES;
    const pressed: number[] = [];
    const released: number[] = [];
    for (const [button, bit] of BUTTON_BITS) {
      if (changed & bit) (buttons & bit ? pressed : released).push(button);
    }
    return { pressed, released };
  }

  /** Forgets every held button; returns whether any was held. Call when the press is cancelled. */
  public clear(): boolean {
    const wasHeld = this.anyHeld;
    this.held = 0;
    return wasHeld;
  }
}
