import { Application } from 'pixi.js';
import { Sound } from './audio/sound';
import classic from './board/classic.json';
import { loadBoard } from './board/loader';
import type { BoardSpec } from './board/types';
import { Machine } from './game/machine';
import { LauncherLogic } from './launcher';
import { fitCabinet } from './layout';
import type { Simulation } from './physics/sim';
import { FixedStepper } from './physics/world';
import { loadSettings, saveSettings, type Settings } from './settings';
import { STARTING_BALLS, newGameState, saveProgress } from './state';
import { COLORS } from './theme';
import { BoardView } from './ui/boardView';
import { Cabinet, REFILL } from './ui/cabinet';
import { FULL_PULL_DRAG } from './ui/launcherView';
import { DONE_BUTTON, LUCK_TRACK, PAYOUT_BUTTONS, SOUND_SWITCH } from './ui/settingsPanel';

/** Sharp on Retina screens without paying for more pixels than anyone can see. */
const MAX_PIXEL_RATIO = 3;
/** The refill card waits this long after the last ball is gone, so it never pops up mid-play. */
const REFILL_DELAY = 0.8;

/** Numbers the browser tests (and the curious) can read from the console. */
interface DebugInfo {
  ballsOnBoard: number;
  ballsRemaining: number;
  ballsAwarded: number;
  /** Balls won that are still trickling into the tray. */
  ballsOwed: number;
  /** Which tulips are open, by id. */
  tulipsOpen: Record<string, boolean>;
  /** True while the tiger is beaming after catching a ball. */
  tigerHappy: boolean;
  lights: number;
  refillShown: boolean;
  fps: number;
  /** Average cost of one physics step; there are two per frame at 60 fps. */
  physicsMsPerStep: number;
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
    payout: Record<string, { x: number; y: number }>;
    refill: { x: number; y: number };
  };
}
declare global {
  interface Window {
    __pachinko?: () => DebugInfo;
    /** For the browser tests: behave as if a ball had just landed in the pocket with this id. */
    __pachinkoCatch?: (pocketId: string) => void;
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

  const params = new URLSearchParams(location.search);
  const state = newGameState();
  // For testing: start with a chosen number of balls, e.g. ?balls=3.
  const startBalls = Number(params.get('balls'));
  if (Number.isInteger(startBalls) && startBalls > 0 && startBalls <= STARTING_BALLS) state.ballsRemaining = startBalls;
  const logic = new LauncherLogic();
  const board = loadBoard(classic as unknown as BoardSpec);
  let sim: Simulation | null = null;

  const settings = loadSettings();
  sound.muted = !settings.soundOn;
  const boardView = new BoardView(board, app.renderer);
  const machine = new Machine({
    onTulip: (id, open) => {
      sim?.setOpen(id, open);
      sound.snap(open);
    },
    onWin: () => sound.win(),
    onTiger: (_pocket, tulips) => {
      const all = tulips >= board.pockets.filter((p) => p.kind === 'tulip').length;
      if (all) sound.cheer();
      else sound.fanfare();
    },
    onBonus: () => sound.fanfare(),
  });
  machine.payout = settings.payout;
  const cabinet = new Cabinet(
    logic,
    settings,
    (changed) => {
      sound.muted = !changed.soundOn;
      sound.unlock();
      machine.payout = changed.payout;
      if (sim) sim.luck = changed.luck;
      saveSettings(changed);
    },
    () => {
      state.ballsRemaining = STARTING_BALLS;
      cabinet.refill.visible = false;
    },
  );
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
  const world: Simulation = new Sim(await loadRapier(), board);
  world.luck = settings.luck;
  sim = world;

  const stress = Number(params.get('stress')) || 0;
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
    onCatch: (pocket: Parameters<Machine['catch']>[0]) => machine.catch(pocket),
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
      if (pendingShot !== null && state.ballsRemaining > 0 && world.launch(pendingShot)) {
        state.ballsRemaining--;
        sound.launch(pendingShot);
        cabinet.launcher.fired();
        pendingShot = null;
      }
      if (state.ballsRemaining === 0) pendingShot = null;

      while (stress > 0 && world.balls.length < stress) {
        if (!world.spawn(-250 + Math.random() * 500, -310 + Math.random() * 50, 0, 0)) break;
      }
      world.step(events);
    }

    // Winnings trickle into the tray and onto the Balls Awarded counter.
    const paid = machine.update(dt);
    if (paid > 0) {
      state.ballsRemaining += paid;
      state.ballsAwarded += paid;
      sound.coin();
    }
    if (steps > 0) physicsMs += ((performance.now() - t0) / steps - physicsMs) * 0.05;
    if (dt > 0) fps += (1 / dt - fps) * 0.05;

    // Out of balls with nothing left in play: offer a free refill.
    if (state.ballsRemaining === 0 && world.balls.length === 0 && !machine.busy) {
      emptyFor += dt;
      if (emptyFor > REFILL_DELAY) cabinet.refill.visible = true;
    } else {
      emptyFor = 0;
      cabinet.refill.visible = false;
    }

    if (state.ballsAwarded !== savedAwarded) {
      savedAwarded = state.ballsAwarded;
      saveProgress(state);
    }

    cabinet.launcher.update(dt);
    boardView.sync(world.balls);
    boardView.update(machine, world.windmills, world.gatePinPositions());
    // The bonus strip blinks all its bulbs while it celebrates.
    cabinet.showLights(machine.bonusFlash > 0 ? (Math.floor(machine.bonusFlash * 6) % 2 === 0 ? 9 : 0) : machine.lights);
    cabinet.show(state);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cabinet.launcher.cancel();
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
        payout: Object.fromEntries(PAYOUT_BUTTONS.map((b) => [String(b.value), at(b.x + b.w / 2, b.y + b.h / 2)])),
        refill: at(REFILL.x, REFILL.buttonY),
      },
      ballsOnBoard: world.balls.length,
      ballsRemaining: state.ballsRemaining,
      ballsAwarded: state.ballsAwarded,
      ballsOwed: machine.owedBalls,
      tulipsOpen: Object.fromEntries(board.pockets.filter((p) => p.kind === 'tulip').map((p) => [p.id, machine.isOpen(p.id)])),
      tigerHappy: machine.cheer > 0,
      lights: machine.lights,
      refillShown: cabinet.refill.visible,
      fps,
      physicsMsPerStep: physicsMs,
      handle: { x: box.left + centre.x, y: box.top + centre.y },
      fullPull: FULL_PULL_DRAG * cabinet.scale.x,
    };
  };
  window.__pachinkoCatch = (id) => {
    const pocket = board.pockets.find((p) => p.id === id);
    if (pocket) machine.catch(pocket);
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
