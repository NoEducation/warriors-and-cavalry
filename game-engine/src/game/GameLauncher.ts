// Runs the way into the game: the start menu, then the loader while the first map is made, then the Game. Also the
// world source the Game loads later maps from, behind the same loader.
import { LoadingOverlay } from '../ui/LoadingOverlay';
import { StartMenu } from '../ui/StartMenu';
import { Game } from './Game';
import type { GameElements } from './GameElements';
import { GAME_CONFIG } from './GameConfig';
import { parseSeed, parseSeedText, randomSeed, writeSeedToUrl } from './seed';
import type { LoadedWorld } from './WorldAssembler';
import { WORLD_GEN_STAGES } from './WorldGenJob';
import { WorldLoader } from './WorldLoader';

/** The page elements the launcher needs: the game's own, plus the menu, loader and error roots. */
export interface LauncherElements extends GameElements {
  readonly menuRoot: HTMLElement;
  readonly loadingRoot: HTMLElement;
  /** Shows a fatal error, e.g. no WebGL. */
  readonly showError: (message: string) => void;
}

/** Seconds a failed "New map" message stays up before the loader gives the old map back. */
const FAILED_LOAD_SECONDS = 3;

export class GameLauncher {
  private readonly loader = new WorldLoader();
  private readonly overlay: LoadingOverlay;
  private game: Game | null = null;

  /** Prepares the loader inside `elements.loadingRoot`; nothing shows until `start`. */
  public constructor(private readonly elements: LauncherElements) {
    this.overlay = new LoadingOverlay(elements.loadingRoot);
  }

  /** Shows the start menu, its seed taken from the URL. Call once. */
  public start(): void {
    document.body.classList.add('in-menu');
    new StartMenu(this.elements.menuRoot, {
      initialSeed: parseSeed(location.search),
      parseSeed: parseSeedText,
      randomSeed,
      onStart: (seed) => void this.begin(seed),
    });
  }

  /** Loads the first map for `seed` behind the loader, then creates and starts the game on it. */
  private async begin(seed: number): Promise<void> {
    writeSeedToUrl(seed);
    await this.loadWorld(seed, (loaded) => {
      document.body.classList.remove('in-menu');
      this.game = new Game(this.elements, loaded, this.loadWorld);
      this.game.start();
    });
  }

  /** The world source: shows the loader, makes the world off the main thread, hands it to `show`, hides the loader. */
  private readonly loadWorld = async (seed: number, show: (loaded: LoadedWorld) => void): Promise<void> => {
    this.overlay.show(`Making map ${seed}`);
    let loaded: LoadedWorld;
    try {
      const params = { seed, width: GAME_CONFIG.mapSize, height: GAME_CONFIG.mapSize };
      loaded = await this.loader.load(params, (stage) => this.overlay.setStage(WORLD_GEN_STAGES[stage]));
    } catch (err) {
      console.error(err);
      this.overlay.showError('The map could not be made.');
      // With a game running, its old map comes back; before the first map, the error stays.
      if (this.game) setTimeout(() => this.overlay.hide(), FAILED_LOAD_SECONDS * 1000);
      return;
    }
    try {
      show(loaded);
    } catch (err) {
      console.error(err);
      this.elements.showError('WebGL is not available in this browser.');
    }
    this.overlay.hide();
  };
}
