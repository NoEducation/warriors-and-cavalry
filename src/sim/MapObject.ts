// An object standing on the map. Plain data, so it can be serialised and sent between peers.
import type { ObjectKind } from './ObjectKind';

/** Object of `kind` whose footprint starts at tile (tx, ty) and extends by the kind's width and height. */
export interface MapObject {
  /** Unique, starting at 1; never reused within a world. */
  readonly id: number;
  readonly kind: ObjectKind;
  readonly tx: number;
  readonly ty: number;
}
