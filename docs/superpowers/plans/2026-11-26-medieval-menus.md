# Medieval Menus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tabbed, categorised build bar and an icon resource bar, both styled medieval.

**Architecture:** Pure data (categories, icon table, cost parts) lives in `src/ui/` and is unit-tested in Node; the DOM
classes `BuildBar`, `BuildButton` and `ResourceBar` consume it. Styles move to `src/ui/ui.css`, imported by `main.ts`.

**Tech Stack:** TypeScript (strict), Vite, Vitest (Node environment, no DOM).

**Spec:** `docs/superpowers/specs/2026-11-26-medieval-menus-design.md`

## Global Constraints

- No image, font or other asset files; no new dependencies. Icons are inline SVG strings in code.
- Font stack: `'Palatino Linotype', Palatino, Georgia, serif`.
- Hotkeys unchanged: Keep 1, Hovel 2, Woodcutter 3, Stockpile 4, Granary 5, Quarry 6, Farm 7, Wall 8, Gate 9, Tower 0,
  Demolish X.
- AGENTS.md style: explicit modifiers and return types, doc comment on every public method, `as const` not `enum`,
  files under ~150 lines, one class per file.

## Review Focus

- Pressing a hotkey for a building in another category: the tray switches to that tab and the button shows active.
- Escape / right-click deselect: no button active, the open tab stays as it is.
- Clicking the open tab again: nothing changes (no tool change, tray stays).
- A 530 px wide window: tab strip and the largest tray (Castle, 4 buttons) fit without overflowing.
- Clicking a button or tab must blur it, so Space (pause) does not press it again.

---

### Task 1: Build categories

**Files:**
- Modify: `src/ui/BuildTool.ts`
- Test: `tests/BuildTool.test.ts` (new)

**Interfaces:**
- Produces:
  - `BuildCategory = { Castle: 'castle', Industry: 'industry', Food: 'food', Town: 'town' } as const` and type
    `BuildCategory`.
  - `BuildToolEntry.category?: BuildCategory` (set for every build tool, absent for Demolish).
  - `interface BuildCategoryEntry { readonly id: BuildCategory; readonly label: string; readonly icon: IconName }`
    (`IconName` from Task 2; until then type `icon` as `string` and tighten in Task 2).
  - `BUILD_CATEGORIES: readonly BuildCategoryEntry[]` in tab order Castle, Industry, Food, Town.
  - `categoryOf(tool: BuildTool): BuildCategory | null` — the category of a build tool; null for Demolish and null.

- [ ] **Step 1: Write failing tests** in `tests/BuildTool.test.ts`:
  - `BUILD_CATEGORIES` labels equal `['Castle', 'Industry', 'Food', 'Town']`.
  - Labels per category (filter `BUILD_TOOLS` by `category`, in `BUILD_TOOLS` order): castle `['Keep','Wall','Gate','Tower']`,
    industry `['Woodcutter','Stockpile','Quarry']`, food `['Granary','Farm']`, town `['Hovel']`.
  - Every build-type entry has a category; the Demolish entry has none.
  - `categoryOf({type:'build',kind:ObjectKind.Gate})` is `'castle'`; `categoryOf({type:'demolish'})` and
    `categoryOf(null)` are null.
- [ ] **Step 2:** `npx vitest run tests/BuildTool.test.ts` — FAIL (exports missing).
- [ ] **Step 3:** Implement in `BuildTool.ts`; `BUILD_TOOLS` order and keys stay as they are.
- [ ] **Step 4:** `npx vitest run tests/BuildTool.test.ts tests/BuildController.test.ts` — PASS.
- [ ] **Step 5:** Commit `ui: build tools belong to Castle, Industry, Food or Town categories`.

### Task 2: Icons and cost parts

**Files:**
- Create: `src/ui/icons.ts`
- Modify: `src/ui/costText.ts`, `src/ui/BuildTool.ts` (type `icon` as `IconName`, add `icon` to `BuildToolEntry`)
- Test: `tests/icons.test.ts` (new), `tests/costText.test.ts`

**Interfaces:**
- Produces:
  - `IconName` union: `'wood' | 'stone' | 'food' | 'peasant' | 'castle' | 'industry' | 'farmTab' | 'town' | 'keep' |
    'hovel' | 'woodcutter' | 'stockpile' | 'granary' | 'quarry' | 'farm' | 'wall' | 'gate' | 'tower' | 'demolish'`.
  - `ICONS: Readonly<Record<IconName, string>>` — inner SVG markup for a `0 0 16 16` view box, using only
    `currentColor` plus a few fixed fills from one `ICON_COLORS` object.
  - `iconSvg(name: IconName): string` — full `<svg viewBox="0 0 16 16" class="icon" aria-hidden="true">…</svg>`.
  - `RESOURCE_ICONS: Readonly<Record<ResourceKind, IconName>>` — wood, stone, food.
  - `BuildToolEntry.icon: IconName` on every entry.
  - `costParts(cost: ResourceAmounts): readonly { kind: ResourceKind; amount: number }[]` — non-zero amounts in
    resource order (empty for free).

- [ ] **Step 1: Failing tests:** every `IconName` has a non-empty entry; `iconSvg('wood')` starts with `<svg` and
  contains `viewBox="0 0 16 16"`; every `BUILD_TOOLS` and `BUILD_CATEGORIES` icon is a key of `ICONS`;
  `costParts(resources(50, 40, 0))` equals `[{kind: Wood, amount: 50}, {kind: Stone, amount: 40}]`;
  `costParts(NO_RESOURCES)` is `[]`.
- [ ] **Step 2:** Run `npx vitest run tests/icons.test.ts tests/costText.test.ts` — FAIL.
- [ ] **Step 3:** Implement. Simple pixel-ish shapes: log end, stone block, wheat sheaf, peasant head and body, keep
  tower with crenels, hammer and pick, house, hut, crates, sack, pickaxe on rock, field rows, wall crenels, arched gate,
  round tower, hammer with a red cross for demolish. `shortCostText` stays (tooltips/other uses) unless unused, then
  remove it and its test.
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** Commit `ui: inline SVG icons for resources, categories and build tools`.

### Task 3: Medieval stylesheet

**Files:**
- Create: `src/ui/ui.css`
- Modify: `index.html` (keep only canvas, error and base page rules inline; move `#hud`, `#resources`, `#buildbar`
  rules out), `src/main.ts` (`import './ui/ui.css';`)

- [ ] **Step 1:** Write `ui.css`: CSS variables in `:root` (`--oak-dark`, `--oak`, `--bronze`, `--gold`,
  `--parchment`, `--danger`), `.panel` look (oak gradient, 2px bronze border with inner gold highlight via
  `box-shadow: inset`, parchment text, serif stack), `#hud` keeps its current monospace look. Classes used by Tasks 4–5:
  `.tabs`, `.tab`, `.tab.open`, `.tab.demolish`, `.tray`, `.tool`, `.tool .key`, `.tool .name`, `.tool .cost`,
  `.tool.active`, `.tool.unaffordable`, `.slot`, `.slot.full`, `.icon`. Breakpoints at 900 px and 640 px shrink icons,
  font and padding.
- [ ] **Step 2:** `npm run build` — PASS (CSS import type-checks under Vite client types).
- [ ] **Step 3:** Commit `ui: move menu styles to ui.css with a medieval oak-and-bronze look`.

### Task 4: Tabbed build bar

**Files:**
- Create: `src/ui/BuildButton.ts` (one tool button: icon, name, key badge, cost with icons, tooltip;
  `setActive(on: boolean): void`, `setAffordable(on: boolean): void`, `readonly element: HTMLButtonElement`)
- Modify: `src/ui/BuildBar.ts`

**Interfaces:**
- Consumes: `BUILD_CATEGORIES`, `categoryOf`, `iconSvg`, `RESOURCE_ICONS`, `costParts` (Tasks 1–2).
- Produces: `BuildBar` public API unchanged (`constructor(root, onSelect)`, `setActive(tool)`, `setAffordable(economy)`);
  `setActive` now also opens `categoryOf(tool)`'s tab when it is not null. New private `openCategory(id)`.

- [ ] **Step 1:** Implement. `root` gets class `panel`; children: `.tabs` (one `.tab` per category plus the Demolish
  `BuildButton` with class `demolish`, at the right end) above `.tray` (one `BuildButton` per build entry, hidden
  unless its category is open). Castle open at start. Tab click: blur, `openCategory`, no `onSelect`. Button click: blur, then the same
  toggle as today. Write the DOM only on state changes (`setAffordable` runs every frame).
- [ ] **Step 2:** `npm run build` and `npx vitest run tests/BuildTool.test.ts tests/layers.test.ts` — PASS.
- [ ] **Step 3:** Commit `ui: build bar shows one category's buildings at a time under category tabs`.

### Task 5: Icon resource bar

**Files:**
- Modify: `src/ui/ResourceBar.ts`, `src/ui/statusText.ts`, `tests/statusText.test.ts`

**Interfaces:**
- Produces: `peasantCountText(population: PopulationSummary): string` → `3/8 (2 idle)` (and `3/8` with no idle);
  `populationText` stays if still used elsewhere, else remove it and its test.

- [ ] **Step 1: Failing test** for `peasantCountText` with idle 2 and idle 0.
- [ ] **Step 2:** Run `npx vitest run tests/statusText.test.ts` — FAIL.
- [ ] **Step 3:** Implement; `ResourceBar` gives `root` class `panel` and builds one `.slot` per resource and one for
  peasants: icon + value span, `title` with the capitalised name. `full` class moves to the slot. Update only on change.
- [ ] **Step 4:** Test PASS, `npm run build` PASS.
- [ ] **Step 5:** Commit `ui: resource bar shows an icon and amount per resource and for peasants`.

### Task 6: Verify and gate

- [ ] **Step 1:** Start `npm run dev` via the preview tool; check console for errors; screenshot the bars; press `8`
  (Castle tray, Wall active), `7` (Food tray, Farm active), Escape (none active, Food stays open); click Industry tab
  (tray changes, no tool); resize to 530 px wide and check nothing overflows.
- [ ] **Step 2:** `npm test` and `npm run build` on the committed HEAD — both PASS.
