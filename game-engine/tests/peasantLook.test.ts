import { describe, expect, it } from 'vitest';
import { HEADWEAR_COLORS, TUNIC_COLORS, peasantLook, toolFor } from '../src/render/peasantLook';
import { PeasantPart } from '../src/render/peasantParts';
import { ObjectKind } from '../src/sim/ObjectKind';

describe('peasantLook', () => {
  it('is the same for the same id and drawn from the palettes', () => {
    for (let id = 1; id < 30; id++) {
      const look = peasantLook(id);
      expect(peasantLook(id)).toEqual(look);
      expect(TUNIC_COLORS).toContain(look.tunic);
      expect(HEADWEAR_COLORS).toContain(look.headwearColor);
      expect(['hat', 'hood']).toContain(look.headwear);
    }
  });

  it('varies over a camp: at least 4 tunic colours and both kinds of headwear among 50 peasants', () => {
    const looks = Array.from({ length: 50 }, (_, i) => peasantLook(i + 1));
    expect(TUNIC_COLORS).toHaveLength(5);
    expect(HEADWEAR_COLORS).toHaveLength(3);
    expect(new Set(looks.map((l) => l.tunic)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(looks.map((l) => l.headwear)).size).toBe(2);
  });
});

describe('toolFor', () => {
  it('gives woodcutters an axe, quarry workers a pick, farmers a hoe and nobody else a tool', () => {
    expect(toolFor(ObjectKind.WoodcutterHut)).toBe(PeasantPart.Axe);
    expect(toolFor(ObjectKind.Quarry)).toBe(PeasantPart.Pick);
    expect(toolFor(ObjectKind.WheatFarm)).toBe(PeasantPart.Hoe);
    expect(toolFor(ObjectKind.Keep)).toBeNull();
    expect(toolFor(undefined)).toBeNull();
  });
});
