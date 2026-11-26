import { describe, expect, it } from 'vitest';
import { Pointer } from '../src/input/Pointer';

const LEFT = 0;
const MIDDLE = 1;
const RIGHT = 2;

/** Bits of `PointerEvent.buttons` for each `PointerEvent.button`. */
const BUTTON_BITS: Readonly<Record<number, number>> = { [LEFT]: 1, [MIDDLE]: 4, [RIGHT]: 2 };

/** A 100 × 100 px canvas stand-in at the page origin that supports pointer capture. */
class FakeCanvas extends EventTarget {
  public captured = new Set<number>();

  public getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return { left: 0, top: 0, width: 100, height: 100 };
  }

  public setPointerCapture(id: number): void {
    this.captured.add(id);
  }

  public hasPointerCapture(id: number): boolean {
    return this.captured.has(id);
  }

  public releasePointerCapture(id: number): void {
    this.captured.delete(id);
  }
}

interface PointerFields {
  readonly button: number;
  readonly buttons: number;
  readonly x: number;
  readonly y: number;
}

function pointerEvent(type: string, { button, buttons, x, y }: PointerFields): Event {
  return Object.assign(new Event(type, { cancelable: true }), { button, buttons, clientX: x, clientY: y, pointerId: 1 });
}

interface Recorded {
  readonly canvas: FakeCanvas;
  readonly events: string[];
}

function setup(): Recorded {
  const canvas = new FakeCanvas();
  const pointer = new Pointer(canvas as unknown as HTMLCanvasElement);
  const events: string[] = [];
  pointer.onPress((button) => events.push(`press ${button}`));
  pointer.onRelease((button) => events.push(`release ${button}`));
  pointer.onClick((button) => events.push(`click ${button}`));
  pointer.onCancel(() => events.push('cancel'));
  return { canvas, events };
}

describe('Pointer press and release', () => {
  it('reports press and release for the left, middle and right buttons', () => {
    const { canvas, events } = setup();
    for (const button of [LEFT, MIDDLE, RIGHT]) {
      canvas.dispatchEvent(pointerEvent('pointerdown', { button, buttons: BUTTON_BITS[button], x: 50, y: 50 }));
      canvas.dispatchEvent(pointerEvent('pointerup', { button, buttons: 0, x: 50, y: 50 }));
    }
    expect(events).toEqual([
      'press 0',
      'release 0',
      'click 0',
      'press 1',
      'release 1',
      'click 1',
      'press 2',
      'release 2',
      'click 2',
    ]);
  });

  it('still reports the release of a captured press let go outside the canvas', () => {
    const { canvas, events } = setup();
    canvas.dispatchEvent(pointerEvent('pointerdown', { button: LEFT, buttons: 1, x: 50, y: 50 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { button: -1, buttons: 1, x: 150, y: 50 }));
    canvas.dispatchEvent(pointerEvent('pointerleave', { button: -1, buttons: 1, x: 150, y: 50 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { button: LEFT, buttons: 0, x: 150, y: 50 }));
    expect(events).toEqual(['press 0', 'release 0']);
  });

  it('reports a second button pressed and released while the first is held', () => {
    const { canvas, events } = setup();
    canvas.dispatchEvent(pointerEvent('pointerdown', { button: LEFT, buttons: 1, x: 50, y: 50 }));
    // The browser reports chorded button changes as pointer moves with `button` set.
    canvas.dispatchEvent(pointerEvent('pointermove', { button: RIGHT, buttons: 3, x: 50, y: 50 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { button: RIGHT, buttons: 1, x: 50, y: 50 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { button: LEFT, buttons: 0, x: 50, y: 50 }));
    // A release seen only as a move is reported as a cancel, never as a release.
    expect(events).toEqual(['press 0', 'press 2', 'cancel', 'release 0', 'click 0']);
  });
});

describe('Pointer cancel', () => {
  const press = (canvas: FakeCanvas): void => {
    canvas.dispatchEvent(pointerEvent('pointerdown', { button: LEFT, buttons: 1, x: 50, y: 50 }));
  };

  it('reports pointercancel as a cancel, with no click after it', () => {
    const { canvas, events } = setup();
    press(canvas);
    canvas.dispatchEvent(pointerEvent('pointercancel', { button: -1, buttons: 0, x: 50, y: 50 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { button: LEFT, buttons: 0, x: 50, y: 50 }));
    expect(events).toEqual(['press 0', 'cancel', 'release 0']);
  });

  it('reports a lost pointer capture while a button is held as a cancel', () => {
    const { canvas, events } = setup();
    press(canvas);
    canvas.dispatchEvent(pointerEvent('lostpointercapture', { button: -1, buttons: 1, x: 50, y: 50 }));
    expect(events).toEqual(['press 0', 'cancel']);
  });

  it('does not report the capture lost after a pointerup as a cancel', () => {
    const { canvas, events } = setup();
    press(canvas);
    canvas.dispatchEvent(pointerEvent('pointerup', { button: LEFT, buttons: 0, x: 50, y: 50 }));
    canvas.dispatchEvent(pointerEvent('lostpointercapture', { button: -1, buttons: 0, x: 50, y: 50 }));
    expect(events).toEqual(['press 0', 'release 0', 'click 0']);
  });

  it('reports leaving the canvas with a button held and no capture as a cancel', () => {
    const { canvas, events } = setup();
    press(canvas);
    canvas.captured.clear(); // capture failed or was never active
    canvas.dispatchEvent(pointerEvent('pointerleave', { button: -1, buttons: 1, x: 150, y: 50 }));
    expect(events).toEqual(['press 0', 'cancel']);
  });

  it('does not cancel when the cursor leaves the canvas with nothing held', () => {
    const { canvas, events } = setup();
    canvas.dispatchEvent(pointerEvent('pointermove', { button: -1, buttons: 0, x: 50, y: 50 }));
    canvas.dispatchEvent(pointerEvent('pointerleave', { button: -1, buttons: 0, x: 150, y: 50 }));
    expect(events).toEqual([]);
  });

  it('reports a release noticed only on a later move as a cancel, and the next press works again', () => {
    const { canvas, events } = setup();
    press(canvas);
    // The pointerup was lost: the next move shows no button held.
    canvas.dispatchEvent(pointerEvent('pointermove', { button: -1, buttons: 0, x: 60, y: 50 }));
    canvas.dispatchEvent(pointerEvent('pointerdown', { button: LEFT, buttons: 1, x: 60, y: 50 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { button: LEFT, buttons: 0, x: 60, y: 50 }));
    expect(events).toEqual(['press 0', 'cancel', 'press 0', 'release 0', 'click 0']);
  });
});
