// HTML bar with one button per build tool: its key, label and cost. Shows the active tool and what cannot be paid.
import { BUILD_TOOLS, type BuildTool, sameTool } from './BuildTool';
import type { EconomyView } from '../sim/Economy';
import { OBJECT_KINDS } from '../sim/ObjectKind';
import { costText, shortCostText } from './costText';

export class BuildBar {
  private readonly buttons: HTMLButtonElement[] = [];
  private active: BuildTool = null;

  /** Builds the buttons inside `root`; `onSelect` receives the clicked tool, or null when the active one is clicked. */
  public constructor(root: HTMLElement, onSelect: (tool: BuildTool) => void) {
    BUILD_TOOLS.forEach((entry, i) => {
      const button = root.appendChild(document.createElement('button'));
      button.type = 'button';
      button.appendChild(document.createElement('span')).textContent = `${i + 1} ${entry.label}`;
      if (entry.tool.type === 'build') {
        const cost = OBJECT_KINDS[entry.tool.kind].cost;
        const costLine = button.appendChild(document.createElement('span'));
        costLine.className = 'cost';
        costLine.textContent = shortCostText(cost);
        button.title = `${OBJECT_KINDS[entry.tool.kind].name}: ${costText(cost)}`;
      }
      button.addEventListener('click', () => {
        // Drop focus so Space/Enter or digit keys later do not press the button again.
        button.blur();
        onSelect(sameTool(this.active, entry.tool) ? null : entry.tool);
      });
      this.buttons.push(button);
    });
  }

  /** Marks the button of `tool` as active (none for null). Call whenever the selected tool changes. */
  public setActive(tool: BuildTool): void {
    this.active = tool;
    BUILD_TOOLS.forEach((entry, i) => this.buttons[i].classList.toggle('active', sameTool(tool, entry.tool)));
  }

  /**
   * Dims (class `unaffordable`) the buttons of buildings whose cost `economy` cannot pay; they stay clickable.
   * Cheap to call every frame: the DOM changes only when a button's state does.
   */
  public setAffordable(economy: EconomyView): void {
    BUILD_TOOLS.forEach((entry, i) => {
      const unaffordable = entry.tool.type === 'build' && !economy.canAfford(OBJECT_KINDS[entry.tool.kind].cost);
      const { classList } = this.buttons[i];
      if (classList.contains('unaffordable') !== unaffordable) classList.toggle('unaffordable', unaffordable);
    });
  }
}
