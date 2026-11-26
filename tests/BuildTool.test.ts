import { describe, expect, it } from 'vitest';
import { BUILD_CATEGORIES, BUILD_TOOLS, BuildCategory, categoryOf } from '../src/ui/BuildTool';
import { ObjectKind } from '../src/sim/ObjectKind';

/** Labels of the build tools in `category`, in bar order. */
function labelsIn(category: BuildCategory): string[] {
  return BUILD_TOOLS.filter((e) => e.category === category).map((e) => e.label);
}

describe('BUILD_CATEGORIES', () => {
  it('lists the tabs Castle, Industry, Food and Town in that order', () => {
    expect(BUILD_CATEGORIES.map((c) => c.label)).toEqual(['Castle', 'Industry', 'Food', 'Town']);
  });

  it('puts each building in its category', () => {
    expect(labelsIn(BuildCategory.Castle)).toEqual(['Keep', 'Wall', 'Gate', 'Tower', 'Stairs']);
    expect(labelsIn(BuildCategory.Industry)).toEqual(['Woodcutter', 'Stockpile', 'Quarry']);
    expect(labelsIn(BuildCategory.Food)).toEqual(['Granary', 'Farm']);
    expect(labelsIn(BuildCategory.Town)).toEqual(['Hovel']);
  });

  it('gives every building a category and Demolish none', () => {
    for (const entry of BUILD_TOOLS) {
      if (entry.tool.type === 'build') expect(entry.category).toBeDefined();
      else expect(entry.category).toBeUndefined();
    }
  });
});

describe('categoryOf', () => {
  it('names the category of a building tool, and null for Demolish or no tool', () => {
    expect(categoryOf({ type: 'build', kind: ObjectKind.Gate })).toBe(BuildCategory.Castle);
    expect(categoryOf({ type: 'build', kind: ObjectKind.WheatFarm })).toBe(BuildCategory.Food);
    expect(categoryOf({ type: 'demolish' })).toBeNull();
    expect(categoryOf(null)).toBeNull();
  });
});
