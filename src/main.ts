import { Application } from 'pixi.js';
import { fitCabinet } from './layout';
import { newGameState } from './state';
import { COLORS } from './theme';
import { Cabinet } from './ui/cabinet';

/** Sharp on Retina screens without paying for more pixels than anyone can see. */
const MAX_PIXEL_RATIO = 3;

async function start(): Promise<void> {
  const host = document.getElementById('stage');
  if (!host) throw new Error('Missing #stage element');

  const app = new Application();
  await app.init({
    resizeTo: host,
    background: COLORS.room,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO),
  });
  host.appendChild(app.canvas);

  const cabinet = new Cabinet();
  app.stage.addChild(cabinet);

  const state = newGameState();
  cabinet.show(state);

  const layout = (): void => {
    const { width, height } = app.screen;
    // A sliver of room around the cabinet on big screens; edge-to-edge on phones.
    const margin = Math.min(width, height) > 600 ? 12 : 0;
    const fit = fitCabinet(width, height, margin);
    cabinet.scale.set(fit.scale);
    cabinet.position.set(fit.x, fit.y);
  };
  app.renderer.on('resize', layout);
  layout();

  // Rapier's WASM is the heavy part of the download; load it after the cabinet is on screen.
  const { createPhysics } = await import('./physics/world');
  const physics = await createPhysics();
  app.ticker.add((ticker) => {
    physics.update(ticker.elapsedMS / 1000);
  });

  document.documentElement.dataset.ready = 'true';
}

start().catch((err: unknown) => {
  console.error(err);
  const box = document.getElementById('error');
  if (box) {
    box.textContent = 'Sorry — the machine could not start on this browser. Try reloading the page.';
    box.style.display = 'flex';
  }
});
