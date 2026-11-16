import { Application } from 'pixi.js';
import { Sound } from './audio/sound';
import classic from './board/classic.json';
import { loadBoard } from './board/loader';
import type { BoardSpec } from './board/types';
import { LauncherLogic } from './launcher';
import { fitCabinet } from './layout';
import type { Simulation } from './physics/sim';
import { FIXED_DT, FixedStepper } from './physics/world';
import { loadSettings, saveSettings, type Settings } from './settings';
import { STARTING_BALLS, newGameState, saveProgress } from './state';
import { COLORS } from './theme';
import { BoardView } from './ui/boardView';
import { Cabinet } from './ui/cabinet';
import { FULL_PULL_DRAG } from './ui/launcherView';
import { DONE_BUTTON, LUCK_TRACK, SOUND_SWITCH } from './ui/settingsPanel';

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
  settings: Settings;
  settingsOpen: boolean;
  /** Where the settings controls are, in CSS pixels. */
  ui: {
    settingsButton: { x: number; y: number };
    soundSwitch: { x: number; y: number };
    luckLeft: { x: number; y: number };
    luckRight: { x: number; y: number };
    done: { x: number; y: number };
  };
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

  const settings = loadSettings();
  sound.muted = !settings.soundOn;
  const cabinet = new Cabinet(logic, settings, (changed) => {
    sound.muted = !changed.soundOn;
    sound.unlock();
    saveSettings(changed);
  });
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
  let savedAwarded = state.ballsAwarded;
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

    if (state.ballsAwarded !== savedAwarded) {
      savedAwarded = state.ballsAwarded;
      saveProgress(state);
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
    const at = (x: number, y: number): { x: number; y: number } => {
      const g = cabinet.toGlobal({ x, y });
      return { x: box.left + g.x, y: box.top + g.y };
    };
    const button = cabinet.settingsButton.position;
    return {
      settings: { ...settings },
      settingsOpen: cabinet.settingsPanel.isOpen,
      ui: {
        settingsButton: at(button.x + 120, button.y + 31),
        soundSwitch: at(SOUND_SWITCH.x + SOUND_SWITCH.w / 2, SOUND_SWITCH.y + SOUND_SWITCH.h / 2),
        luckLeft: at(LUCK_TRACK.x0, LUCK_TRACK.y),
        luckRight: at(LUCK_TRACK.x1, LUCK_TRACK.y),
        done: at(DONE_BUTTON.x + DONE_BUTTON.w / 2, DONE_BUTTON.y + DONE_BUTTON.h / 2),
      },
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
