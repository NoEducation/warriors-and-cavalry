// HTML panel of an opened Barracks: a button per soldier kind with its cost, the training queue and the soldier count.
import type { SoldierSummary } from '../sim/Army';
import type { EconomyView } from '../sim/Economy';
import type { TrainingQueueView } from '../sim/Training';
import { UNIT_KIND_LIST, type UnitKind, UNIT_KINDS } from '../sim/UnitKind';
import { soldierCountText, trainButtonText } from './raidText';

/** What the panel shows of its Barracks. */
export interface BarracksPanelView {
  readonly queue: TrainingQueueView;
  readonly soldiers: SoldierSummary;
  readonly economy: EconomyView;
}

export class BarracksPanel {
  private readonly root: HTMLDivElement;
  private readonly buttons = new Map<UnitKind, HTMLButtonElement>();
  private readonly queueLine: HTMLDivElement;
  private readonly soldierLine: HTMLDivElement;

  /** Builds the hidden panel inside `parent`; `onTrain` runs when a soldier button is clicked, `onClose` on ✕. */
  public constructor(parent: HTMLElement, onTrain: (kind: UnitKind) => void, onClose: () => void) {
    this.root = parent.appendChild(document.createElement('div'));
    this.root.className = 'panel barracks-panel';
    this.root.hidden = true;
    const title = this.root.appendChild(document.createElement('div'));
    title.className = 'title';
    title.textContent = 'Barracks';
    const close = title.appendChild(document.createElement('button'));
    close.type = 'button';
    close.className = 'close';
    close.textContent = '✕';
    close.addEventListener('click', () => onClose());
    for (const kind of UNIT_KIND_LIST) {
      const button = this.root.appendChild(document.createElement('button'));
      button.type = 'button';
      button.className = 'train';
      button.textContent = trainButtonText(kind);
      button.addEventListener('click', () => {
        button.blur();
        onTrain(kind);
      });
      this.buttons.set(kind, button);
    }
    this.queueLine = this.root.appendChild(document.createElement('div'));
    this.soldierLine = this.root.appendChild(document.createElement('div'));
  }

  /** True while the panel is shown. */
  public get isOpen(): boolean {
    return !this.root.hidden;
  }

  /** Shows the panel. */
  public show(): void {
    this.root.hidden = false;
  }

  /** Hides the panel. */
  public hide(): void {
    this.root.hidden = true;
  }

  /**
   * Shows `view`: buttons dimmed when the soldier cannot be paid or there is no room, the queue with the front
   * soldier's progress, and the soldier count. Cheap to call every frame: the DOM changes only when the text does.
   */
  public update(view: BarracksPanelView): void {
    const { queue, soldiers, economy } = view;
    const full = soldiers.count + queue.kinds.length >= soldiers.room;
    for (const [kind, button] of this.buttons) button.classList.toggle('unaffordable', full || !economy.canAfford(UNIT_KINDS[kind].cost));
    const front = queue.kinds[0];
    const training = front === undefined ? 'Nobody in training' : `Training ${UNIT_KINDS[front].name} ${Math.floor((100 * queue.progress) / UNIT_KINDS[front].trainTicks)}%`;
    const queued = queue.kinds.length > 1 ? ` · ${queue.kinds.length - 1} waiting` : '';
    this.setText(this.queueLine, training + queued);
    this.setText(this.soldierLine, `Soldiers ${soldierCountText(soldiers)}`);
  }

  private setText(element: HTMLElement, text: string): void {
    if (element.textContent !== text) element.textContent = text;
  }
}
