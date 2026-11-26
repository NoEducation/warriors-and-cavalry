// HTML build bar: category tabs (with Demolish at their end) above a tray with the open category's buttons.
// Shows the active tool, opening its category, and dims what cannot be paid.
import { BUILD_CATEGORIES, BUILD_TOOLS, type BuildCategory, type BuildTool, categoryOf, sameTool } from './BuildTool';
import type { EconomyView } from '../sim/Economy';
import { OBJECT_KINDS } from '../sim/ObjectKind';
import { BuildButton } from './BuildButton';
import { iconSvg } from './icons';

export class BuildBar {
  private readonly buttons: BuildButton[] = [];
  private readonly tabs = new Map<BuildCategory, HTMLButtonElement>();
  private active: BuildTool = null;
  private open: BuildCategory | null = null;

  /** Builds the tabs and buttons inside `root`; `onSelect` receives the clicked tool, or null when the active one is clicked. */
  public constructor(root: HTMLElement, onSelect: (tool: BuildTool) => void) {
    const tabRow = root.appendChild(document.createElement('div'));
    tabRow.className = 'tabs';
    const tray = root.appendChild(document.createElement('div'));
    tray.className = 'tray';
    for (const category of BUILD_CATEGORIES) {
      const tab = tabRow.appendChild(document.createElement('button'));
      tab.type = 'button';
      tab.className = 'tab';
      tab.title = category.label;
      tab.insertAdjacentHTML('beforeend', iconSvg(category.icon));
      const label = tab.appendChild(document.createElement('span'));
      label.className = 'label';
      label.textContent = category.label;
      tab.addEventListener('click', () => {
        tab.blur();
        this.openCategory(category.id);
      });
      this.tabs.set(category.id, tab);
    }
    for (const entry of BUILD_TOOLS) {
      const parent = entry.category === undefined ? tabRow : tray;
      const button = new BuildButton(entry, parent, () =>
        onSelect(sameTool(this.active, entry.tool) ? null : entry.tool),
      );
      if (entry.category === undefined) button.element.classList.add('demolish');
      this.buttons.push(button);
    }
    this.openCategory(BUILD_CATEGORIES[0].id);
  }

  /**
   * Marks the button of `tool` as active (none for null) and opens the tab of its category, so a hotkey's building is
   * always in view. Call whenever the selected tool changes.
   */
  public setActive(tool: BuildTool): void {
    this.active = tool;
    for (const button of this.buttons) button.setActive(sameTool(tool, button.entry.tool));
    const category = categoryOf(tool);
    if (category !== null) this.openCategory(category);
  }

  /**
   * Dims the buttons of buildings whose cost `economy` cannot pay; they stay clickable.
   * Cheap to call every frame: the DOM changes only when a button's state does.
   */
  public setAffordable(economy: EconomyView): void {
    for (const button of this.buttons) {
      const { tool } = button.entry;
      button.setAffordable(tool.type !== 'build' || economy.canAfford(OBJECT_KINDS[tool.kind].cost));
    }
  }

  /** Shows the buttons of `category` in the tray and marks its tab open; nothing when it already is. */
  private openCategory(category: BuildCategory): void {
    if (category === this.open) return;
    this.open = category;
    for (const [id, tab] of this.tabs) tab.classList.toggle('open', id === category);
    for (const button of this.buttons) {
      if (button.entry.category !== undefined) button.element.hidden = button.entry.category !== category;
    }
  }
}
