# Medieval menus: categorised build bar and icon resource bar

## Intent

The top resource bar and the bottom build bar look like a debug overlay (monospace text on translucent black, one flat
row of eleven buttons). The owner wants them to read as a medieval strategy game's UI: the build bar grouped into
categories, the resource bar with an icon per item, both styled to fit the setting. The game will grow more
buildings, so the build bar must scale past one row.

## Goals

- Build bar grouped into categories shown as tabs (Stronghold-style): one category's buildings visible at a time.
- Resource bar with an icon per resource and for peasants.
- Medieval look for both: wood, bronze/gold trim, parchment text, serif type.

## Non-goals

- The top-left debug HUD (clock, seed, tile, FPS, messages) keeps its current look.
- No change to simulation, costs or tools.

## Anti-goals

- Any image, font or other asset file, or any new dependency (AGENTS.md).
- Losing the one-key building selection (1–0, X).

## Approaches

- **A. Category tabs (chosen).** Tabs pick which category's buildings the tray shows. Clean and scales to many
  buildings; costs one extra click with the mouse.
- **B. Grouped, always visible.** All buttons in labelled groups with dividers. One click, but crowds as buildings are
  added.

The owner picked A.

## Design

### Categories

| Category | Buildings |
| --- | --- |
| Castle | Keep, Wall, Gate, Tower |
| Industry | Woodcutter, Quarry, Stockpile |
| Food | Farm, Granary |
| Town | Hovel |

Demolish is not in a category: it sits apart at the right end of the tab strip.

### Bottom bar

- Two tiers: a tab strip (four category tabs with an icon and name, then Demolish), and a tray with the chosen
  category's building buttons.
- Each building button: SVG icon, name, hotkey badge in a corner, cost with small resource icons (`[log]50 [stone]40`).
  Unaffordable: dimmed, cost in red, still clickable. Active tool: gold glow.
- Hotkeys 1–0 and X keep their current buildings and work from any tab; pressing one also opens its category's tab so
  the active tool is visible. Clicking a tab only changes the tray, not the tool. Castle is open at start.
- Tooltips keep the full name and cost text.

### Top bar

- One framed panel with four slots: wood, stone, food, peasants. Each: icon plus `amount/capacity`
  (peasants: `count/housing`, plus `(n idle)` when any). Tooltip with the full name. A full store keeps the gold
  highlight.

### Look

- Panels: dark oak gradient, beveled bronze/gold border, parchment-coloured text, serif system font stack
  (`'Palatino Linotype', Palatino, Georgia, serif`).
- Buttons as inset wooden plaques; active tab raised and joined to the tray.
- Icons: inline SVG built in code, one table in `src/ui/icons.ts`.
- Styles move from `index.html` into `src/ui/ui.css`, imported by `main.ts`. Narrow windows still fit the bar.

### Code

- `BuildTool.ts`: `BuildToolEntry` gains `category` (absent for Demolish); new `BUILD_CATEGORIES` table (id, label,
  icon) and a pure `categoryOf(tool)` lookup.
- `BuildBar` builds the tab strip and tray; `setActive` also switches to the tool's category.
- `ResourceBar` builds icon slots.
- Tests: category table contents and order, every build tool in exactly one category, `categoryOf` for a hotkey's
  tool.

## Left to the builder

Exact colours, icon drawings, spacing and the narrow-window breakpoints.
