// What sets one peasant apart from another (tunic, headwear) and which tool a worker holds.
import { ObjectKind } from '../sim/ObjectKind';
import { hash2 } from '../sim/rng';
import { PeasantPart } from './peasantParts';

/** Muted tunic colours (sRGB). */
export const TUNIC_COLORS: readonly number[] = Object.freeze([0xeadfc0, 0x8a6f4e, 0x6f7f55, 0x8c5a4a, 0x5f6f86]);
/** Straw, undyed wool and brown headwear (sRGB). */
export const HEADWEAR_COLORS: readonly number[] = Object.freeze([0xc89b3c, 0xb9ad94, 0x6a4d33]);

const LOOK_SEED = 0x5eed;

/** How one peasant is dressed. */
export interface PeasantLook {
  readonly tunic: number;
  readonly headwear: 'hat' | 'hood';
  readonly headwearColor: number;
}

/** The look of peasant `id`: always the same for the same id. Cheap; fine to call per frame. */
export function peasantLook(id: number): PeasantLook {
  const pick = (palette: readonly number[], salt: number): number =>
    palette[Math.floor(hash2(LOOK_SEED, id, salt) * palette.length)];
  return {
    tunic: pick(TUNIC_COLORS, 0),
    headwear: hash2(LOOK_SEED, id, 1) < 0.6 ? 'hat' : 'hood',
    headwearColor: pick(HEADWEAR_COLORS, 2),
  };
}

/** The tool a worker at a building of `kind` holds; null when it holds none. */
export function toolFor(kind: ObjectKind | undefined): PeasantPart | null {
  switch (kind) {
    case ObjectKind.WoodcutterHut: return PeasantPart.Axe;
    case ObjectKind.Quarry: return PeasantPart.Pick;
    case ObjectKind.WheatFarm: return PeasantPart.Hoe;
    default: return null;
  }
}
