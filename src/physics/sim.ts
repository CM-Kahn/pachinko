import type { Collider, RigidBody, World, EventQueue } from '@dimforge/rapier2d-compat';
import { angleOf } from '../board/loader';
import { WINDMILL_BLADES, isCaught, pocketOutline, tigerCircles } from '../board/shapes';
import type { Board, Pocket } from '../board/types';
import { FIXED_DT, type Rapier } from './world';

/** Board units (design pixels) per physics unit. Rapier is happiest with sizes near 1. */
const SCALE = 100;

/** The feel of the machine. Speeds and gravity are in board units. */
export const TUNING = {
  gravity: 2300,
  ballRestitution: 0.52,
  ballFriction: 0.06,
  ballLinearDamping: 0.04,
  ballAngularDamping: 0.6,
  pinRestitution: 0.56,
  wallRestitution: 0.12,
  wallFriction: 0.02,
  bumperRestitution: 0.85,
  /** Shot-to-shot variation in launch speed, as a fraction, so streams spread naturally. */
  launchJitter: 0.006,
  /** A ball slower than this (units/s) for `stuckAfter` seconds gets a nudge. */
  stuckSpeed: 14,
  stuckAfter: 0.6,
  maxBalls: 160,
  /**
   * The luck setting leans balls that are just above a catcher towards it (or away from it).
   * This is the sideways pull at full luck, in board units per second squared.
   */
  luckPull: 1500,
  luckReachX: 85,
  luckReachY: 120,
  /** Windmills spin freely; this is how quickly they coast to a stop. */
  windmillDamping: 1.2,
  windmillDensity: 0.5,
} as const;

export type HitKind = 'pin' | 'wall' | 'rail' | 'bumper' | 'ball' | 'cup';

export interface Ball {
  readonly id: number;
  x: number;
  y: number;
  rotation: number;
  /** False while the ball is still riding up the launch lane; a ball that drains without entering fell back and should be refunded. */
  entered: boolean;
  /** @internal Physics body; absent while the ball is riding the guide rail. */ body: RigidBody | null;
  /** @internal Angle (radians) and angular speed while riding the guide rail. */ theta: number;
  /** @internal */ omega: number;
  /** @internal */ still: number;
}

export interface SimEvents {
  /** A ball struck something. `speed` is the ball's speed in board units per second. */
  onHit?(kind: HitKind, speed: number, x: number, y: number): void;
  /** A ball left the board through the out hole. */
  onDrain?(ball: Ball): void;
  /** A ball was caught by a pocket, a tulip or the tiger. */
  onCatch?(pocket: Pocket, ball: Ball): void;
}

interface PocketState {
  pocket: Pocket;
  open: boolean;
  /** Walls for the closed and open shapes; only the current one is switched on. */
  closedWalls: Collider | null;
  openWalls: Collider | null;
}

/** The pachinko board as a physics world. Knows nothing about drawing or sound. */
export class Simulation {
  readonly balls: Ball[] = [];
  private readonly world: World;
  private readonly queue: EventQueue;
  private readonly kinds = new Map<number, HitKind>();
  private readonly byCollider = new Map<number, Ball>();
  private readonly pockets: PocketState[] = [];
  private readonly mills: RigidBody[] = [];
  /** Where each windmill is and how far it has turned (radians), for drawing. */
  readonly windmills: { x: number; y: number; rotation: number }[] = [];
  private nextId = 1;
  /** The luck setting, -1 (harder) to +1 (easier). */
  luck = 0;

  constructor(
    private readonly R: Rapier,
    readonly board: Board,
    private readonly random: () => number = Math.random,
  ) {
    this.world = new R.World({ x: 0, y: TUNING.gravity / SCALE });
    this.world.timestep = FIXED_DT;
    this.queue = new R.EventQueue(true);

    const fixed = this.world.createRigidBody(R.RigidBodyDesc.fixed());
    const add = (desc: InstanceType<Rapier['ColliderDesc']>, kind: HitKind): void => {
      this.kinds.set(this.world.createCollider(desc, fixed).handle, kind);
    };
    const chain = (pts: { x: number; y: number }[], closed: boolean): InstanceType<Rapier['ColliderDesc']> => {
      const verts = new Float32Array(pts.flatMap((p) => [p.x / SCALE, p.y / SCALE]));
      const idx: number[] = [];
      for (let i = 0; i + 1 < pts.length; i++) idx.push(i, i + 1);
      if (closed) idx.push(pts.length - 1, 0);
      return R.ColliderDesc.polyline(verts, new Uint32Array(idx))
        .setRestitution(TUNING.wallRestitution)
        .setRestitutionCombineRule(R.CoefficientCombineRule.Min)
        .setFriction(TUNING.wallFriction)
        .setFrictionCombineRule(R.CoefficientCombineRule.Min);
    };

    add(chain(board.wall, true), 'wall');
    add(chain(board.rail, false), 'rail');
    for (const end of [board.rail[0], board.rail[board.rail.length - 1]]) {
      if (end) add(R.ColliderDesc.ball(3 / SCALE).setTranslation(end.x / SCALE, end.y / SCALE).setRestitution(0.3), 'rail');
    }
    for (const p of board.pins) {
      add(
        R.ColliderDesc.ball(board.pinRadius / SCALE)
          .setTranslation(p.x / SCALE, p.y / SCALE)
          .setRestitution(TUNING.pinRestitution)
          .setFriction(TUNING.ballFriction),
        'pin',
      );
    }
    for (const b of board.bumpers) {
      add(
        R.ColliderDesc.ball(b.radius / SCALE)
          .setTranslation(b.x / SCALE, b.y / SCALE)
          .setRestitution(TUNING.bumperRestitution)
          .setRestitutionCombineRule(R.CoefficientCombineRule.Max),
        'bumper',
      );
    }

    for (const c of tigerCircles(board.tiger)) {
      add(R.ColliderDesc.ball(c.r / SCALE).setTranslation(c.x / SCALE, c.y / SCALE).setRestitution(0.3).setFriction(TUNING.wallFriction), 'cup');
    }

    // A windmill is a body that can only turn; balls striking its blades spin it.
    for (const w of board.windmills) {
      const body = this.world.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation(w.x / SCALE, w.y / SCALE)
          .lockTranslations()
          .setGravityScale(0)
          .setAngularDamping(TUNING.windmillDamping)
          .setCanSleep(false),
      );
      const reach = board.windmillRadius / SCALE;
      for (let k = 0; k < WINDMILL_BLADES; k++) {
        const a = (k / WINDMILL_BLADES) * Math.PI * 2;
        const blade = R.ColliderDesc.cuboid(reach / 2, 2.5 / SCALE)
          .setTranslation((Math.cos(a) * reach) / 2, (Math.sin(a) * reach) / 2)
          .setRotation(a)
          .setDensity(TUNING.windmillDensity)
          .setRestitution(0.3)
          .setFriction(0.2);
        this.kinds.set(this.world.createCollider(blade, body).handle, 'cup');
      }
      this.mills.push(body);
      this.windmills.push({ x: w.x, y: w.y, rotation: 0 });
    }

    for (const pocket of board.pockets) {
      const walls = (open: boolean): Collider | null => {
        const pts = pocketOutline(pocket, open).map((p) => ({ x: pocket.x + p.x, y: pocket.y + p.y }));
        if (pts.length < 2) return null;
        const collider = this.world.createCollider(chain(pts, false).setRestitution(0.25), fixed);
        this.kinds.set(collider.handle, 'cup');
        return collider;
      };
      const closedWalls = walls(false);
      const openWalls = pocket.kind === 'tulip' ? walls(true) : null;
      openWalls?.setEnabled(false);
      this.pockets.push({ pocket, open: false, closedWalls, openWalls });
    }
  }

  /** Open or close a tulip. */
  setOpen(id: string, open: boolean): void {
    const state = this.pockets.find((p) => p.pocket.id === id);
    if (!state || state.open === open) return;
    state.open = open;
    if (state.openWalls) {
      state.closedWalls?.setEnabled(!open);
      state.openWalls.setEnabled(open);
    }
  }

  isOpen(id: string): boolean {
    return this.pockets.find((p) => p.pocket.id === id)?.open ?? false;
  }

  /** True when the launch point is clear and there is room for another ball. */
  canLaunch(): boolean {
    if (this.balls.length >= TUNING.maxBalls) return false;
    const { x, y } = this.board.launch;
    const clear = this.board.ballRadius * 2.2;
    return !this.balls.some((b) => Math.hypot(b.x - x, b.y - y) < clear);
  }

  /** Fire a ball up the launch lane. `power` runs from 0 (weakest pull) to 1 (strongest). */
  launch(power: number): Ball | null {
    if (!this.canLaunch()) return null;
    const l = this.board.launch;
    const p = Math.min(1, Math.max(0, power));
    const jitter = 1 + (this.random() * 2 - 1) * TUNING.launchJitter;
    const speed = (l.minSpeed + (l.maxSpeed - l.minSpeed) * p) * jitter;
    const ball: Ball = {
      id: this.nextId++,
      x: l.x,
      y: l.y,
      rotation: 0,
      entered: false,
      body: null,
      theta: Math.atan2(l.y, l.x),
      omega: speed / this.ridingRadius,
      still: 0,
    };
    this.balls.push(ball);
    return ball;
  }

  /** Put a ball straight onto the board (used for tests and stress runs). */
  spawn(x: number, y: number, vx: number, vy: number, entered = true): Ball | null {
    if (this.balls.length >= TUNING.maxBalls) return null;
    const ball: Ball = { id: this.nextId++, x, y, rotation: 0, entered, body: null, theta: 0, omega: 0, still: 0 };
    this.attach(ball, vx, vy);
    this.balls.push(ball);
    return ball;
  }

  /** Radius of the path a ball's centre follows while it rides the outer rail. */
  private get ridingRadius(): number {
    return this.board.radius - this.board.ballRadius;
  }

  /** Give a ball a physics body at its current position. */
  private attach(ball: Ball, vx: number, vy: number): void {
    const R = this.R;
    const { x, y } = ball;
    const body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(x / SCALE, y / SCALE)
        .setLinvel(vx / SCALE, vy / SCALE)
        .setLinearDamping(TUNING.ballLinearDamping)
        .setAngularDamping(TUNING.ballAngularDamping)
        .setCcdEnabled(true)
        .setCanSleep(false),
    );
    const collider = this.world.createCollider(
      R.ColliderDesc.ball(this.board.ballRadius / SCALE)
        .setRestitution(TUNING.ballRestitution)
        .setFriction(TUNING.ballFriction)
        .setDensity(1)
        .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    ball.body = body;
    this.kinds.set(collider.handle, 'ball');
    this.byCollider.set(collider.handle, ball);
  }

  /**
   * A launched ball rides the guide rail on a exact circular path rather than through the
   * physics engine: it keeps shots perfectly repeatable and free of rattle. It joins the
   * physics world when it drops off the rail or reaches the stopper. Returns true if the
   * ball rolled all the way back down the lane.
   */
  private ride(ball: Ball): boolean {
    const rho = this.ridingRadius;
    const { railSpec, launch, bumpers, ballRadius } = this.board;
    ball.omega += ((TUNING.gravity * Math.cos(ball.theta)) / rho) * FIXED_DT;
    const dTheta = ball.omega * FIXED_DT;
    ball.theta += dTheta;
    ball.rotation += dTheta * (rho / ballRadius);
    ball.x = Math.cos(ball.theta) * rho;
    ball.y = Math.sin(ball.theta) * rho;

    const deg = (ball.theta * 180) / Math.PI;
    if (ball.omega < 0 && deg <= angleOf(launch.x, launch.y)) return true;
    if (deg <= railSpec.to) return false;

    // Past the end of the inner rail: the ball stays on the outer rail only while it is
    // moving fast enough to be pressed against it.
    const speed = ball.omega * rho;
    const pressed = (speed * speed) / rho + TUNING.gravity * Math.sin(ball.theta) > 0;
    const stopper = bumpers[0];
    const stopAt = stopper
      ? angleOf(stopper.x, stopper.y) - (Math.asin((ballRadius + stopper.radius + 3) / rho) * 180) / Math.PI
      : 350;
    if (!pressed || ball.omega <= 0 || deg >= stopAt) {
      ball.entered = true;
      // Step in from the rail a hair so the physics engine starts from a clean position.
      ball.x *= (rho - 1) / rho;
      ball.y *= (rho - 1) / rho;
      this.attach(ball, -Math.sin(ball.theta) * speed, Math.cos(ball.theta) * speed);
    }
    return false;
  }

  /** Advance one fixed step. */
  step(events: SimEvents = {}): void {
    this.world.step(this.queue);

    this.queue.drainCollisionEvents((h1, h2, started) => {
      if (!started || !events.onHit) return;
      const a = this.byCollider.get(h1);
      const b = this.byCollider.get(h2);
      const ball = a ?? b;
      if (!ball) return;
      const kind = a && b ? 'ball' : (this.kinds.get(a ? h2 : h1) ?? 'pin');
      if (!ball.body) return;
      const v = ball.body.linvel();
      const p = ball.body.translation();
      events.onHit(kind, Math.hypot(v.x, v.y) * SCALE, p.x * SCALE, p.y * SCALE);
    });

    this.mills.forEach((body, i) => (this.windmills[i]!.rotation = body.rotation()));

    const { drain, radius } = this.board;
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i]!;
      const body = ball.body;
      if (!body) {
        if (this.ride(ball)) {
          this.remove(i);
          events.onDrain?.(ball);
        }
        continue;
      }
      const p = body.translation();
      ball.x = p.x * SCALE;
      ball.y = p.y * SCALE;
      ball.rotation = body.rotation();

      const drained = Math.abs(ball.x - drain.x) < drain.halfWidth && Math.abs(ball.y - drain.y) < drain.halfHeight;
      // Nothing should ever get outside the rail, but never keep a lost ball around.
      const escaped = !(Math.hypot(ball.x, ball.y) < radius + 40);
      if (drained || escaped) {
        this.remove(i);
        events.onDrain?.(ball);
        continue;
      }

      let caught: Pocket | null = null;
      for (const state of this.pockets) {
        const { pocket } = state;
        const dx = ball.x - pocket.x;
        const dy = ball.y - pocket.y;
        if (isCaught(pocket, dx, dy)) {
          caught = pocket;
          break;
        }
        // Luck: a ball falling just above a catcher is leaned towards it, or away from it.
        if (this.luck !== 0 && pocket.kind !== 'crown' && dy < 0 && dy > -TUNING.luckReachY && Math.abs(dx) < TUNING.luckReachX) {
          const lean = -Math.sign(dx) * Math.min(1, Math.abs(dx) / 12);
          body.applyImpulse({ x: (this.luck * lean * TUNING.luckPull * body.mass() * FIXED_DT) / SCALE, y: 0 }, true);
        }
      }
      if (caught) {
        this.remove(i);
        events.onCatch?.(caught, ball);
        continue;
      }

      // A ball can come to rest cradled on a row of pins; give it the tap a player would.
      const v = body.linvel();
      if (Math.hypot(v.x, v.y) * SCALE < TUNING.stuckSpeed) {
        ball.still += FIXED_DT;
        if (ball.still > TUNING.stuckAfter) {
          ball.still = 0;
          const m = body.mass();
          const side = this.random() < 0.5 ? -1 : 1;
          body.applyImpulse({ x: (side * m * (90 + this.random() * 90)) / SCALE, y: (-m * (140 + this.random() * 80)) / SCALE }, true);
        }
      } else {
        ball.still = 0;
      }
    }
  }

  /** Remove every ball (e.g. when starting over). */
  clear(): void {
    for (let i = this.balls.length - 1; i >= 0; i--) this.remove(i);
  }

  private remove(index: number): void {
    const ball = this.balls[index]!;
    if (ball.body) {
      for (let c = 0; c < ball.body.numColliders(); c++) {
        const h = ball.body.collider(c).handle;
        this.kinds.delete(h);
        this.byCollider.delete(h);
      }
      this.world.removeRigidBody(ball.body);
      ball.body = null;
    }
    this.balls.splice(index, 1);
  }
}
