// The tools a player can pick from the build bar, in bar order.
import { ObjectKind } from '../sim/ObjectKind';

/** What a click on the map does: place a building of `kind`, demolish, or nothing (null). */
export type BuildTool = { readonly type: 'build'; readonly kind: ObjectKind } | { readonly type: 'demolish' } | null;

/** One build bar button: its label, keyboard key (`KeyboardEvent.code`) and tool. */
export interface BuildToolEntry {
  readonly label: string;
  readonly key: string;
  readonly tool: Exclude<BuildTool, null>;
}

export const BUILD_TOOLS: readonly BuildToolEntry[] = Object.freeze([
  { label: 'Keep', key: 'Digit1', tool: { type: 'build', kind: ObjectKind.Keep } },
  { label: 'Hovel', key: 'Digit2', tool: { type: 'build', kind: ObjectKind.Hovel } },
  { label: 'Woodcutter', key: 'Digit3', tool: { type: 'build', kind: ObjectKind.WoodcutterHut } },
  { label: 'Stockpile', key: 'Digit4', tool: { type: 'build', kind: ObjectKind.Stockpile } },
  { label: 'Granary', key: 'Digit5', tool: { type: 'build', kind: ObjectKind.Granary } },
  { label: 'Quarry', key: 'Digit6', tool: { type: 'build', kind: ObjectKind.Quarry } },
  { label: 'Farm', key: 'Digit7', tool: { type: 'build', kind: ObjectKind.WheatFarm } },
  { label: 'Wall', key: 'Digit8', tool: { type: 'build', kind: ObjectKind.Wall } },
  { label: 'Gate', key: 'Digit9', tool: { type: 'build', kind: ObjectKind.Gate } },
  { label: 'Tower', key: 'Digit0', tool: { type: 'build', kind: ObjectKind.Tower } },
  { label: 'Demolish', key: 'KeyX', tool: { type: 'demolish' } },
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
