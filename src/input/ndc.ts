// Normalised device coordinates of a cursor in an element's CSS box. No DOM needed.

/** Normalised device coordinates: -1..1 on both axes, +y up. */
export interface NdcPoint {
  readonly x: number;
  readonly y: number;
}

/** An element's CSS box in client coordinates, as `getBoundingClientRect` gives it. */
export interface ClientBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Where client point (clientX, clientY) lies in `box`, edges included; null outside it. */
export function ndcInBox(box: ClientBox, clientX: number, clientY: number): NdcPoint | null {
  const u = (clientX - box.left) / box.width;
  const v = (clientY - box.top) / box.height;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? { x: u * 2 - 1, y: -v * 2 + 1 } : null;
}
