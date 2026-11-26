// One build bar button: the tool's icon, name, key badge and, for buildings, its cost with resource icons.
import { type BuildToolEntry, keyLabel } from './BuildTool';
import { OBJECT_KINDS } from '../sim/ObjectKind';
import { costParts, costText } from './costText';
import { RESOURCE_ICONS, iconSvg } from './icons';

export class BuildButton {
  public readonly element: HTMLButtonElement;
  private active = false;
  private affordable = true;

  /** Builds the button for `entry` inside `parent`; `onClick` runs on each click, after the button drops focus. */
  public constructor(
    public readonly entry: BuildToolEntry,
    parent: HTMLElement,
    onClick: () => void,
  ) {
    const button = parent.appendChild(document.createElement('button'));
    button.type = 'button';
    button.className = 'tool';
    button.insertAdjacentHTML('beforeend', iconSvg(entry.icon));
    this.addSpan(button, 'name', entry.label);
    this.addSpan(button, 'key', keyLabel(entry.key));
    if (entry.tool.type === 'build') {
      const { name, cost } = OBJECT_KINDS[entry.tool.kind];
      const costLine = this.addSpan(button, 'cost', '');
      for (const part of costParts(cost)) {
        const piece = this.addSpan(costLine, '', String(part.amount));
        piece.insertAdjacentHTML('afterbegin', iconSvg(RESOURCE_ICONS[part.kind]));
      }
      if (costLine.childElementCount === 0) costLine.textContent = 'free';
      button.title = `${name} (${keyLabel(entry.key)}): ${costText(cost)}`;
    } else {
      button.title = `${entry.label} (${keyLabel(entry.key)})`;
    }
    button.addEventListener('click', () => {
      // Drop focus so Space/Enter or digit keys later do not press the button again.
      button.blur();
      onClick();
    });
    this.element = button;
  }

  /** Shows the button as the selected tool or not. Touches the DOM only when the state changes. */
  public setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    this.element.classList.toggle('active', active);
  }

  /** Dims the button (class `unaffordable`) when its cost cannot be paid. Touches the DOM only on a change. */
  public setAffordable(affordable: boolean): void {
    if (affordable === this.affordable) return;
    this.affordable = affordable;
    this.element.classList.toggle('unaffordable', !affordable);
  }

  private addSpan(parent: HTMLElement, className: string, text: string): HTMLSpanElement {
    const span = parent.appendChild(document.createElement('span'));
    if (className) span.className = className;
    span.textContent = text;
    return span;
  }
}
