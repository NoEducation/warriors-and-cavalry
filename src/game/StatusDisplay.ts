// Per-frame refresh of the status widgets: the HUD clock, the resource and population bar and build bar affordability.
import { gameTimeAt } from '../sim/gameTime';
import type { World } from '../sim/World';
import type { Hud } from '../ui/Hud';
import type { ResourceBar } from '../ui/ResourceBar';
import type { BuildInput } from './BuildInput';
import type { SimulationRunner } from './SimulationRunner';

export class StatusDisplay {
  /** What the clock last showed; the clock is rebuilt only when one of these changes. */
  private shownTicks = -1;
  private shownPaused = false;
  private shownSpeed = 0;

  /** Uses the given widgets and runner; owns none of them. */
  public constructor(
    private readonly hud: Hud,
    private readonly resourceBar: ResourceBar,
    private readonly buildInput: BuildInput,
    private readonly runner: SimulationRunner,
  ) {}

  /** Shows the clock, resources, population and affordable buildings of `world`. Call once per frame, after ticking. */
  public update(world: World): void {
    this.updateClock(world.tickCount);
    // Not skipped with the clock: placing or demolishing changes the economy and housing without a tick, even paused.
    this.resourceBar.update(world.economy, world.population);
    this.buildInput.showAffordable(world.economy);
  }

  /** Returns early when the tick count, pause and speed are what the clock already shows. */
  private updateClock(ticks: number): void {
    const { paused, speed } = this.runner;
    if (ticks === this.shownTicks && paused === this.shownPaused && speed === this.shownSpeed) return;
    this.hud.setClock(gameTimeAt(ticks), paused, speed);
    this.shownTicks = ticks;
    this.shownPaused = paused;
    this.shownSpeed = speed;
  }
}
