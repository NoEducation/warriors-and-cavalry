// HTML bar showing the camp's resources and people as icon slots: [log] 100/250 [stone] 40/250 [sheaf] 50/100 [peasant] 3/8.
import type { EconomyView } from '../sim/Economy';
import type { PopulationSummary } from '../sim/Population';
import { RESOURCE_KINDS, RESOURCE_NAMES, type ResourceKind } from '../sim/ResourceKind';
import { type IconName, RESOURCE_ICONS, iconSvg } from './icons';
import { peasantCountText } from './statusText';

/** One slot's elements and what it last showed. */
interface Slot {
  readonly element: HTMLSpanElement;
  readonly value: HTMLSpanElement;
  text: string;
  full: boolean;
}

export class ResourceBar {
  private readonly resources = new Map<ResourceKind, Slot>();
  private readonly peasants: Slot;

  /** Builds one slot per resource and one for the peasants inside `root`. Create once at setup. */
  public constructor(private readonly root: HTMLElement) {
    for (const kind of RESOURCE_KINDS) {
      const name = RESOURCE_NAMES[kind];
      this.resources.set(kind, this.addSlot(RESOURCE_ICONS[kind], name.charAt(0).toUpperCase() + name.slice(1)));
    }
    this.peasants = this.addSlot('peasant', 'Peasants');
  }

  /**
   * Shows each amount and capacity of `economy`, a resource at capacity with the class `full`, then the `population`.
   * Cheap to call every frame: the DOM changes only when a value does.
   */
  public update(economy: EconomyView, population: PopulationSummary): void {
    for (const [kind, slot] of this.resources) {
      const amount = economy.amount(kind);
      const capacity = economy.capacity(kind);
      this.show(slot, `${amount}/${capacity}`, amount >= capacity);
    }
    this.show(this.peasants, peasantCountText(population), false);
  }

  private addSlot(icon: IconName, title: string): Slot {
    const element = this.root.appendChild(document.createElement('span'));
    element.className = 'slot';
    element.title = title;
    element.insertAdjacentHTML('beforeend', iconSvg(icon));
    const value = element.appendChild(document.createElement('span'));
    return { element, value, text: '', full: false };
  }

  private show(slot: Slot, text: string, full: boolean): void {
    if (text !== slot.text) {
      slot.text = text;
      slot.value.textContent = text;
    }
    if (full !== slot.full) {
      slot.full = full;
      slot.element.classList.toggle('full', full);
    }
  }
}
