import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BuildController } from '../src/game/BuildController';
import { BuildInput } from '../src/game/BuildInput';
import { Pointer } from '../src/input/Pointer';
import { Economy } from '../src/sim/Economy';
import { GameMap } from '../src/sim/GameMap';
import { ObjectKind } from '../src/sim/ObjectKind';
import { resources } from '../src/sim/ResourceKind';
import type { TileCoord } from '../src/sim/TileCoord';
import { TileType } from '../src/sim/tiles';
import { World } from '../src/sim/World';

const LEFT = 0;
const RIGHT = 2;
const SIZE = 16;
const START: TileCoord = { tx: 5, ty: 5 };
const END: TileCoord = { tx: 9, ty: 5 };

/** Just enough of an HTML element for the build bar's buttons. */
class FakeElement extends EventTarget {
  public textContent = '';
  public title = '';
  public className = '';
  public type = '';
  public hidden = false;
  public readonly childElementCount = 0;
  public readonly classList = { add: (): void => {}, toggle: (): void => {}, contains: (): boolean => false };

  public appendChild<T>(child: T): T {
    return child;
  }

  public insertAdjacentHTML(): void {}

  public blur(): void {}
}

/** A 100 × 100 px canvas stand-in at the page origin that supports pointer capture. */
class FakeCanvas extends EventTarget {
  public readonly captured = new Set<number>();

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

function pointerEvent(type: string, button: number, buttons: number, x = 50): Event {
  const fields = { button, buttons, clientX: x, clientY: 50, pointerId: 1 };
  return Object.assign(new Event(type, { cancelable: true }), fields);
}

interface Setup {
  readonly world: World;
  readonly canvas: FakeCanvas;
  readonly keys: EventTarget;
  readonly builder: BuildController;
  readonly input: BuildInput;
  /** The tile the next press or release acts on. */
  readonly cursor: { tile: TileCoord | null };
}

function setup(): Setup {
  const tiles = new Uint8Array(SIZE * SIZE).fill(TileType.Grass);
  const map = new GameMap(SIZE, SIZE, 1, new Float32Array((SIZE + 1) * (SIZE + 1)), tiles);
  const world = new World(map, new Economy(resources(0, 100, 0)));
  const canvas = new FakeCanvas();
  const keys = new EventTarget();
  const builder = new BuildController(() => {});
  const pointer = new Pointer(canvas as unknown as HTMLCanvasElement);
  const bar = new FakeElement() as unknown as HTMLElement;
  const cursor: { tile: TileCoord | null } = { tile: START };
  const input = new BuildInput(builder, bar, keys, pointer, () => ({ world, tile: cursor.tile }));
  keys.dispatchEvent(Object.assign(new Event('keydown'), { code: 'Digit8' })); // the Wall tool
  return { world, canvas, keys, builder, input, cursor };
}

/** Presses the left button over START and moves the cursor so the drag shows the line to END. */
function startDrag(s: Setup): void {
  s.canvas.dispatchEvent(pointerEvent('pointerdown', LEFT, 1));
  s.cursor.tile = END;
  s.builder.wallDragPreview(s.world, END);
  s.canvas.dispatchEvent(pointerEvent('pointermove', -1, 1, 80));
}

function release(s: Setup): void {
  s.canvas.dispatchEvent(pointerEvent('pointerup', LEFT, 0, 80));
}

describe('BuildInput wall drags', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { createElement: (): FakeElement => new FakeElement() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds the dragged line on release', () => {
    const s = setup();
    startDrag(s);
    release(s);
    expect(s.world.objectCount).toBe(5);
    expect(s.world.objectAt(9, 5)?.kind).toBe(ObjectKind.Wall);
  });

  it('builds the line to the last tile seen when released off the map', () => {
    const s = setup();
    startDrag(s);
    s.cursor.tile = null;
    release(s);
    expect(s.world.objectCount).toBe(5);
  });

  it('builds nothing after a pointercancel', () => {
    const s = setup();
    startDrag(s);
    s.canvas.dispatchEvent(pointerEvent('pointercancel', -1, 0));
    expect(s.builder.isWallDragging).toBe(false);
    release(s);
    expect(s.world.objectCount).toBe(0);
  });

  it('builds nothing after the pointer capture is lost while the button is held', () => {
    const s = setup();
    startDrag(s);
    s.canvas.dispatchEvent(pointerEvent('lostpointercapture', -1, 1));
    expect(s.builder.isWallDragging).toBe(false);
    expect(s.world.objectCount).toBe(0);
  });

  it('builds nothing when the cursor leaves the canvas without pointer capture', () => {
    const s = setup();
    startDrag(s);
    s.canvas.captured.clear();
    s.canvas.dispatchEvent(pointerEvent('pointerleave', -1, 1, 150));
    expect(s.builder.isWallDragging).toBe(false);
    expect(s.world.objectCount).toBe(0);
  });

  it('builds nothing when the release is only noticed on a later move', () => {
    const s = setup();
    startDrag(s);
    s.canvas.dispatchEvent(pointerEvent('pointermove', -1, 0, 85));
    expect(s.builder.isWallDragging).toBe(false);
    expect(s.world.objectCount).toBe(0);
  });

  it('builds nothing when a new map is loaded mid-drag', () => {
    const s = setup();
    startDrag(s);
    s.input.resetForNewMap();
    expect(s.builder.isWallDragging).toBe(false);
    release(s);
    expect(s.world.objectCount).toBe(0);
  });

  it('cancels a drag on Escape and on a right press, keeping the Wall tool', () => {
    const s = setup();
    startDrag(s);
    s.keys.dispatchEvent(Object.assign(new Event('keydown'), { code: 'Escape' }));
    expect(s.builder.isWallDragging).toBe(false);
    release(s);
    s.cursor.tile = START;
    startDrag(s);
    s.canvas.dispatchEvent(pointerEvent('pointermove', RIGHT, 3, 80));
    s.canvas.dispatchEvent(pointerEvent('pointermove', RIGHT, 1, 80));
    release(s);
    expect(s.world.objectCount).toBe(0);
    expect(s.builder.tool).toEqual({ type: 'build', kind: ObjectKind.Wall });
  });

  it('deselects the tool on a right click without a drag', () => {
    const s = setup();
    s.canvas.dispatchEvent(pointerEvent('pointerdown', RIGHT, 2));
    s.canvas.dispatchEvent(pointerEvent('pointerup', RIGHT, 0));
    expect(s.builder.tool).toBeNull();
  });
});
