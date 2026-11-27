// What sets one peasant apart from another (tunic, headwear) and which tool a worker holds.
import { ObjectKind } from '../sim/ObjectKind';
import { hash2 } from '../sim/rng';
import { PeasantPart } from './peasantParts';

/** Muted tunic colours (sRGB). */
export const TUNIC_COLORS: readonly number[] = Object.freeze([0xa89c80, 0x6a553c, 0x525b3c, 0x6c443a, 0x48505e]);
/** Straw, undyed wool and brown headwear (sRGB). */
export const HEADWEAR_COLORS: readonly number[] = Object.freeze([0x8f7034, 0x8a8170, 0x52402b]);

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
