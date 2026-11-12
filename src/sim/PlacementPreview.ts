// Where a building would go and whether it fits; shared by the build logic and the placement ghost.
import type { ObjectKind } from './ObjectKind';

/** Where a building of `kind` would go (footprint anchor tile) and whether it may be placed there. */
export interface PlacementPreview {
  readonly kind: ObjectKind;
  readonly tx: number;
  readonly ty: number;
  readonly ok: boolean;
}
