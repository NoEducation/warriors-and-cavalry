// Per-frame refresh of the status widgets: the HUD clock, the resource bar and build bar affordability.
import { gameTimeAt } from '../sim/gameTime';
import type { World } from '../sim/World';
import type { Hud } from '../ui/Hud';
import type { ResourceBar } from '../ui/ResourceBar';
import type { BuildInput } from './BuildInput';
import type { SimulationRunner } from './SimulationRunner';

export class StatusDisplay {
  /** Uses the given widgets and runner; owns none of them. */
  public constructor(
    private readonly hud: Hud,
    private readonly resourceBar: ResourceBar,
    private readonly buildInput: BuildInput,
    private readonly runner: SimulationRunner,
  ) {}

  /** Shows the clock, resources and affordable buildings of `world`. Call once per frame, after ticking. */
  public update(world: World): void {
    this.hud.setClock(gameTimeAt(world.tickCount), this.runner.paused, this.runner.speed);
    this.resourceBar.update(world.economy);
    this.buildInput.showAffordable(world.economy);
  }
}
