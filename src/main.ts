// Entry point: finds the page elements and starts the launcher (start menu, loader, then the game).
import './ui/ui.css';
import { GameLauncher } from './game/GameLauncher';

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
  const menuRoot = document.getElementById('menu');
  const loadingRoot = document.getElementById('loading');
  if (!(canvas instanceof HTMLCanvasElement) || !hudRoot || !resourceRoot || !buildBarRoot || !menuRoot || !loadingRoot) {
    throw new Error(
      'index.html must contain <canvas id="game">, <div id="hud">, <div id="resources">, <div id="buildbar">, ' +
        '<div id="menu"> and <div id="loading">',
    );
  }
  new GameLauncher({ canvas, hudRoot, resourceRoot, buildBarRoot, menuRoot, loadingRoot, showError }).start();
}

main();
