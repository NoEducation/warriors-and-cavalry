// HTML bar showing the camp's resources: `Wood 100/250 · Stone 40/250 · Food 50/100`.
import type { EconomyView } from '../sim/Economy';
import { RESOURCE_KINDS, RESOURCE_NAMES, type ResourceKind } from '../sim/ResourceKind';

/** One resource's element and what it last showed. */
interface ResourceEntry {
  readonly kind: ResourceKind;
  readonly label: string;
  readonly element: HTMLSpanElement;
  text: string;
  full: boolean;
}

export class ResourceBar {
  private readonly entries: ResourceEntry[] = [];

  /** Builds one element per resource inside `root`. Create once at setup. */
  public constructor(root: HTMLElement) {
    RESOURCE_KINDS.forEach((kind, i) => {
      if (i > 0) root.appendChild(document.createTextNode(' · '));
      const element = root.appendChild(document.createElement('span'));
      const name = RESOURCE_NAMES[kind];
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      this.entries.push({ kind, label, element, text: '', full: false });
    });
  }

  /**
   * Shows each amount and capacity of `economy`; a resource at capacity gets the class `full`.
   * Cheap to call every frame: the DOM changes only when a value does.
   */
  public update(economy: EconomyView): void {
    for (const entry of this.entries) {
      const amount = economy.amount(entry.kind);
      const capacity = economy.capacity(entry.kind);
      const text = `${entry.label} ${amount}/${capacity}`;
      if (text !== entry.text) {
        entry.text = text;
        entry.element.textContent = text;
      }
      const full = amount >= capacity;
      if (full !== entry.full) {
        entry.full = full;
        entry.element.classList.toggle('full', full);
      }
    }
  }
}
