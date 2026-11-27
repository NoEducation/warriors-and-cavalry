// Player input for soldiers: with no build tool, a left click selects (Shift adds), a left drag draws a selection
// box, a right click orders the selection, a click on a Barracks opens its panel, and Escape lets go of everything.
import * as THREE from 'three';
import type { Keyboard } from '../input/Keyboard';
import type { NdcPoint, Pointer, PointerDrag } from '../input/Pointer';
import type { TileCoord } from '../sim/TileCoord';
import { Side } from '../sim/UnitKind';
import type { UnitView } from '../sim/UnitView';
import type { World } from '../sim/World';
import type { BarracksInput } from './BarracksInput';
import type { BuildController } from './BuildController';
import type { SelectionController } from './SelectionController';
import { type DrawnUnit, unitsInBox } from './unitPick';

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

/** What selection input reads and acts on; Game owns all of it. */
export interface SelectionTargets {
  readonly selection: SelectionController;
  readonly barracks: BarracksInput;
  readonly builder: BuildController;
  readonly keyboard: Keyboard;
  readonly currentWorld: () => World;
  readonly camera: () => THREE.Camera;
  readonly tileUnderCursor: () => TileCoord | null;
  /** Where `unit` is drawn this frame, into `out`; false while no unit layer is shown. */
  readonly placeOf: (world: World, unit: UnitView, out: THREE.Vector3) => boolean;
  readonly onMessage: (text: string) => void;
}

export class SelectionInput {
  private readonly box: HTMLDivElement;
  /** Where a left press with no build tool started (NDC); null otherwise. */
  private boxStart: NdcPoint | null = null;
  private boxing = false;
  /** Whether a build tool was chosen when the current right press began (that press only drops the tool). */
  private toolAtRightPress = false;

  /**
   * Listens on `pointer` and `keyTarget`, drawing the selection box over `canvas`. Create before `BuildInput`, so a
   * right press that drops a build tool is seen with the tool still chosen.
   */
  public constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly pointer: Pointer,
    keyTarget: EventTarget,
    private readonly targets: SelectionTargets,
  ) {
    this.box = (canvas.parentElement ?? document.body).appendChild(document.createElement('div'));
    this.box.className = 'select-box';
    this.box.hidden = true;
    pointer.onPress(this.onPress);
    pointer.onDrag(this.onDrag);
    pointer.onRelease(this.onRelease);
    pointer.onClick(this.onClick);
    pointer.onCancel(() => this.endBox());
    keyTarget.addEventListener('keydown', this.onKeyDown);
  }

  /** Lets go of the selection, the panel and any box; they belong to the old map. Call when a new map is loaded. */
  public resetForNewMap(): void {
    this.targets.selection.clear();
    this.targets.barracks.close();
    this.endBox();
  }

  private get noTool(): boolean {
    return this.targets.builder.tool === null;
  }

  private get shift(): boolean {
    return this.targets.keyboard.isDown('ShiftLeft') || this.targets.keyboard.isDown('ShiftRight');
  }

  private readonly onPress = (button: number): void => {
    if (button === RIGHT_BUTTON) this.toolAtRightPress = !this.noTool;
    if (button !== LEFT_BUTTON || !this.noTool) return;
    this.boxStart = this.pointer.ndc;
    this.boxing = false;
  };

  private readonly onDrag = (drag: PointerDrag): void => {
    if (drag.button !== LEFT_BUTTON || !this.boxStart || !this.pointer.ndc) return;
    this.boxing = true;
    this.drawBox(this.boxStart, this.pointer.ndc);
  };

  private readonly onRelease = (button: number): void => {
    if (button !== LEFT_BUTTON) return;
    const { boxStart, boxing } = this;
    const end = this.pointer.ndc;
    this.endBox();
    if (!boxing || !boxStart || !end) return;
    const world = this.targets.currentWorld();
    this.targets.selection.select(world, unitsInBox(this.drawnSoldiers(world), this.targets.camera(), boxStart, end), this.shift);
  };

  private readonly onClick = (button: number): void => {
    const world = this.targets.currentWorld();
    const tile = this.targets.tileUnderCursor();
    if (button === RIGHT_BUTTON) {
      this.targets.barracks.close();
      if (this.toolAtRightPress || !tile) return;
      const result = this.targets.selection.orderAt(world, tile);
      if (result && !result.ok) this.targets.onMessage('Cannot order: no way there');
      return;
    }
    if (button !== LEFT_BUTTON || !this.noTool || !tile) return;
    const hit = this.targets.selection.clickAt(world, tile, this.shift);
    if (hit || !this.targets.barracks.openAt(world, tile)) this.targets.barracks.close();
  };

  private readonly onKeyDown = (e: Event): void => {
    if ((e as KeyboardEvent).code !== 'Escape') return;
    this.targets.selection.clear();
    this.targets.barracks.close();
  };

  /** The player's living units and where they are drawn now. */
  private drawnSoldiers(world: World): DrawnUnit[] {
    const drawn: DrawnUnit[] = [];
    for (const unit of world.units()) {
      if (unit.side !== Side.Player || unit.hitPoints <= 0) continue;
      const at = new THREE.Vector3();
      if (this.targets.placeOf(world, unit, at)) drawn.push({ id: unit.id, at });
    }
    return drawn;
  }

  /** Shows the selection box between NDC points `a` and `b`, in the canvas's CSS box. */
  private drawBox(a: NdcPoint, b: NdcPoint): void {
    const rect = this.canvas.getBoundingClientRect();
    const toX = (x: number): number => rect.left + ((x + 1) / 2) * rect.width;
    const toY = (y: number): number => rect.top + ((1 - y) / 2) * rect.height;
    const [x0, x1] = [toX(a.x), toX(b.x)].sort((p, q) => p - q);
    const [y0, y1] = [toY(a.y), toY(b.y)].sort((p, q) => p - q);
    Object.assign(this.box.style, { left: `${x0}px`, top: `${y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
    this.box.hidden = false;
  }

  private endBox(): void {
    this.boxStart = null;
    this.boxing = false;
    this.box.hidden = true;
  }
}
