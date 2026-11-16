import { Application } from 'pixi.js';
import { Sound } from './audio/sound';
import classic from './board/classic.json';
import { loadBoard } from './board/loader';
import type { BoardSpec } from './board/types';
import { LauncherLogic } from './launcher';
import { fitCabinet } from './layout';
import type { Simulation } from './physics/sim';
import { FIXED_DT, FixedStepper } from './physics/world';
import { STARTING_BALLS, newGameState } from './state';
import { COLORS } from './theme';
import { BoardView } from './ui/boardView';
import { Cabinet } from './ui/cabinet';
import { FULL_PULL_DRAG } from './ui/launcherView';

/** Sharp on Retina screens without paying for more pixels than anyone can see. */
const MAX_PIXEL_RATIO = 3;
/** Until payouts and the refill button arrive in Phase 3, an empty machine tops itself up. */
const AUTO_REFILL_DELAY = 1.5;

/** Numbers the browser tests (and the curious) can read from the console. */
interface DebugInfo {
  ballsOnBoard: number;
  ballsRemaining: number;
  fps: number;
  physicsMsPerFrame: number;
  /** Centre of the launch handle's grab area, in CSS pixels. */
  handle: { x: number; y: number };
  /** CSS pixels of drag for a full pull. */
  fullPull: number;
}
declare global {
  interface Window {
    __pachinko?: () => DebugInfo;
  }
}

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

  const sound = new Sound();
  const unlock = (): void => sound.unlock();
  for (const type of ['pointerdown', 'touchend', 'keydown'] as const) {
    window.addEventListener(type, unlock, { passive: true });
  }

  const state = newGameState();
  const logic = new LauncherLogic();
  const board = loadBoard(classic as BoardSpec);

  const cabinet = new Cabinet(logic, (on) => {
    sound.muted = !on;
    sound.unlock();
  });
  cabinet.soundButton.set(!sound.muted);
  const boardView = new BoardView(board, app.renderer);
  cabinet.boardLayer.addChild(boardView);
  app.stage.addChild(cabinet);
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

  // The cabinet is on screen; now fetch the physics engine (the heavy part of the download).
  const [{ Simulation: Sim }, { loadRapier }] = await Promise.all([import('./physics/sim'), import('./physics/world')]);
  const sim: Simulation = new Sim(await loadRapier(), board);

  const stress = Number(new URLSearchParams(location.search).get('stress')) || 0;
  const stepper = new FixedStepper();
  let pendingShot: number | null = null;
  let emptyFor = 0;
  let fps = 60;
  let physicsMs = 0;

  const events = {
    onHit: (kind: Parameters<Sound['hit']>[0], speed: number) => sound.hit(kind, speed),
    onDrain: (ball: { entered: boolean }) => {
      // A ball that rolled back down the launch lane goes back in the tray.
      if (ball.entered) sound.drain();
      else state.ballsRemaining++;
    },
  };

  cabinet.launcher.onTouch = unlock;
  cabinet.launcher.onRelease = (flick) => {
    if (flick !== null) pendingShot = flick;
  };

  app.ticker.add((ticker) => {
    const dt = ticker.elapsedMS / 1000;
    const steps = stepper.advance(dt);
    const t0 = performance.now();
    for (let i = 0; i < steps; i++) {
      const shot = logic.update(FIXED_DT);
      if (shot !== null) pendingShot = shot;
      if (pendingShot !== null && state.ballsRemaining > 0 && sim.launch(pendingShot)) {
        state.ballsRemaining--;
        sound.launch(pendingShot);
        cabinet.launcher.fired();
        pendingShot = null;
      }
      if (state.ballsRemaining === 0) pendingShot = null;

      while (stress > 0 && sim.balls.length < stress) {
        if (!sim.spawn(-250 + Math.random() * 500, -310 + Math.random() * 50, 0, 0)) break;
      }
      sim.step(events);
    }
    physicsMs += (performance.now() - t0 - physicsMs) * 0.05;
    if (dt > 0) fps += (1 / dt - fps) * 0.05;

    if (state.ballsRemaining === 0 && sim.balls.length === 0) {
      emptyFor += dt;
      if (emptyFor > AUTO_REFILL_DELAY) state.ballsRemaining = STARTING_BALLS;
    } else {
      emptyFor = 0;
    }

    cabinet.launcher.update(dt);
    boardView.sync(sim.balls);
    cabinet.show(state);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cabinet.launcher.onRelease(logic.release());
  });

  window.__pachinko = () => {
    const area = cabinet.launcher.grabArea;
    const centre = cabinet.launcher.toGlobal({ x: area.x + area.width / 2, y: area.y + area.height * 0.3 });
    const box = app.canvas.getBoundingClientRect();
    return {
      ballsOnBoard: sim.balls.length,
      ballsRemaining: state.ballsRemaining,
      fps,
      physicsMsPerFrame: physicsMs,
      handle: { x: box.left + centre.x, y: box.top + centre.y },
      fullPull: FULL_PULL_DRAG * cabinet.scale.x,
    };
  };
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
