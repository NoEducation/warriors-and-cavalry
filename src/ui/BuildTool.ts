// The tools a player can pick from the build bar, in bar order, and the category tabs they are grouped under.
import { ObjectKind } from '../sim/ObjectKind';
import type { IconName } from './icons';

/** What a click on the map does: place a building of `kind`, demolish, or nothing (null). */
export type BuildTool = { readonly type: 'build'; readonly kind: ObjectKind } | { readonly type: 'demolish' } | null;

/** The build bar's category tabs. */
export const BuildCategory = {
  Castle: 'castle',
  Industry: 'industry',
  Food: 'food',
  Town: 'town',
} as const;
export type BuildCategory = (typeof BuildCategory)[keyof typeof BuildCategory];

/** One category tab: its id, label and icon. */
export interface BuildCategoryEntry {
  readonly id: BuildCategory;
  readonly label: string;
  readonly icon: IconName;
}

/** One build bar button: its label, keyboard key (`KeyboardEvent.code`), tool, icon and, for buildings, its category. */
export interface BuildToolEntry {
  readonly label: string;
  readonly key: string;
  readonly tool: Exclude<BuildTool, null>;
  readonly icon: IconName;
  readonly category?: BuildCategory;
}

/** The category tabs, in tab order. */
export const BUILD_CATEGORIES: readonly BuildCategoryEntry[] = Object.freeze([
  { id: BuildCategory.Castle, label: 'Castle', icon: 'castle' },
  { id: BuildCategory.Industry, label: 'Industry', icon: 'industry' },
  { id: BuildCategory.Food, label: 'Food', icon: 'farmTab' },
  { id: BuildCategory.Town, label: 'Town', icon: 'town' },
]);

export const BUILD_TOOLS: readonly BuildToolEntry[] = Object.freeze([
  {
    label: 'Keep',
    icon: 'keep',
    key: 'Digit1',
    tool: { type: 'build', kind: ObjectKind.Keep },
    category: BuildCategory.Castle,
  },
  {
    label: 'Hovel',
    icon: 'hovel',
    key: 'Digit2',
    tool: { type: 'build', kind: ObjectKind.Hovel },
    category: BuildCategory.Town,
  },
  {
    label: 'Woodcutter',
    icon: 'woodcutter',
    key: 'Digit3',
    tool: { type: 'build', kind: ObjectKind.WoodcutterHut },
    category: BuildCategory.Industry,
  },
  {
    label: 'Stockpile',
    icon: 'stockpile',
    key: 'Digit4',
    tool: { type: 'build', kind: ObjectKind.Stockpile },
    category: BuildCategory.Industry,
  },
  {
    label: 'Granary',
    icon: 'granary',
    key: 'Digit5',
    tool: { type: 'build', kind: ObjectKind.Granary },
    category: BuildCategory.Food,
  },
  {
    label: 'Quarry',
    icon: 'quarry',
    key: 'Digit6',
    tool: { type: 'build', kind: ObjectKind.Quarry },
    category: BuildCategory.Industry,
  },
  {
    label: 'Farm',
    icon: 'farm',
    key: 'Digit7',
    tool: { type: 'build', kind: ObjectKind.WheatFarm },
    category: BuildCategory.Food,
  },
  {
    label: 'Wall',
    icon: 'wall',
    key: 'Digit8',
    tool: { type: 'build', kind: ObjectKind.Wall },
    category: BuildCategory.Castle,
  },
  {
    label: 'Gate',
    icon: 'gate',
    key: 'Digit9',
    tool: { type: 'build', kind: ObjectKind.Gate },
    category: BuildCategory.Castle,
  },
  {
    label: 'Tower',
    icon: 'tower',
    key: 'Digit0',
    tool: { type: 'build', kind: ObjectKind.Tower },
    category: BuildCategory.Castle,
  },
  {
    label: 'Stairs',
    icon: 'stairs',
    key: 'KeyT',
    tool: { type: 'build', kind: ObjectKind.Stairs },
    category: BuildCategory.Castle,
  },
  { label: 'Demolish', icon: 'demolish', key: 'KeyX', tool: { type: 'demolish' } },
]);

/** The key a button shows for `code`: `8` for `Digit8`, `X` for `KeyX`. */
export function keyLabel(code: string): string {
  return code.replace(/^(Digit|Key)/, '');
}

/** True when `a` and `b` are the same tool (or both null). */
export function sameTool(a: BuildTool, b: BuildTool): boolean {
  if (a === null || b === null) return a === b;
  if (a.type === 'build' && b.type === 'build') return a.kind === b.kind;
  return a.type === b.type;
}

/** The category tab `tool` sits under; null for Demolish and for no tool. Use to open the tab of a hotkey's tool. */
export function categoryOf(tool: BuildTool): BuildCategory | null {
  return BUILD_TOOLS.find((entry) => sameTool(entry.tool, tool))?.category ?? null;
}
