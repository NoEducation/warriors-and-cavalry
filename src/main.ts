// Entry point: finds the page elements, creates the Game and starts it.
import { Game } from './game/Game';

function showError(message: string): void {
  const el = document.getElementById('error');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

function main(): void {
  const canvas = document.getElementById('game');
  const hudRoot = document.getElementById('hud');
  const resourceRoot = document.getElementById('resources');
  const buildBarRoot = document.getElementById('buildbar');
  if (!(canvas instanceof HTMLCanvasElement) || !hudRoot || !resourceRoot || !buildBarRoot) {
    throw new Error(
      'index.html must contain <canvas id="game">, <div id="hud">, <div id="resources"> and <div id="buildbar">',
    );
  }

  let game: Game;
  try {
    game = new Game(canvas, hudRoot, resourceRoot, buildBarRoot);
  } catch (err) {
    console.error(err);
    showError('WebGL is not available in this browser.');
    return;
  }
  game.start();
}

main();
