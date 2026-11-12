// HTML bar with one button per build tool; shows which tool is active.
import { BUILD_TOOLS, type BuildTool, sameTool } from '../game/BuildTool';

export class BuildBar {
  private readonly buttons: HTMLButtonElement[] = [];
  private active: BuildTool = null;

  /** Builds the buttons inside `root`; `onSelect` receives the clicked tool, or null when the active one is clicked. */
  public constructor(root: HTMLElement, onSelect: (tool: BuildTool) => void) {
    BUILD_TOOLS.forEach((entry, i) => {
      const button = root.appendChild(document.createElement('button'));
      button.type = 'button';
      button.textContent = `${i + 1} ${entry.label}`;
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
}
