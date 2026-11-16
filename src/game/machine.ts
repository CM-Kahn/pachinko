import type { Pocket } from '../board/types';

/**
 * The rules of the machine: what each catch pays, how the reels behave, and how a jackpot
 * plays out. Knows nothing about physics, drawing or sound; it is told about catches and
 * the passing of time, and reports what happened through `MachineEvents`.
 */
export const RULES = {
  /** Highest symbol on a reel; symbols run from 1 to this. */
  symbols: 7,
  /** Chance that a spin is a jackpot, and that a losing spin teases with a reach. */
  jackpotChance: 1 / 16,
  reachChance: 0.2,
  /** Spins waiting their turn; a start catch beyond this still pays but adds no spin. */
  maxHeldSpins: 4,
  /** Seconds from the start of a spin until each reel stops. */
  reelStops: [0.9, 1.5, 2.1],
  /** On a reach the last reel keeps turning this much longer. */
  reachExtra: 2.2,
  /** Pause after the reels stop before the next spin (or the jackpot) begins. */
  afterSpin: 0.7,
  jackpot: { rounds: 5, luckySevenRounds: 8, catchesPerRound: 8, roundSeconds: 11, pause: 1.3 },
  /** Each tulip catch lights one bulb of the strip; a full strip pays a bonus. */
  bonus: { lights: 9, payMultiple: 2, flashSeconds: 2 },
  /** Winnings trickle into the tray at this many balls per second, like a real payout. */
  payoutRate: 28,
} as const;

export type Reels = [number, number, number];

export interface MachineEvents {
  onTulip?(id: string, open: boolean): void;
  onAttacker?(open: boolean): void;
  onSpinStart?(): void;
  onReelStop?(reel: number, symbol: number): void;
  onReach?(): void;
  onJackpot?(rounds: number): void;
  onRound?(round: number, rounds: number): void;
  onJackpotEnd?(): void;
  onBonus?(): void;
  onWin?(pocket: Pocket, balls: number): void;
}

interface Spin {
  result: Reels;
  reach: boolean;
  jackpot: boolean;
  time: number;
  stopped: number;
  end: number;
}

interface Jackpot {
  round: number;
  rounds: number;
  caught: number;
  /** Seconds left in the round while open, or in the pause while closed. */
  timer: number;
  open: boolean;
}

export class Machine {
  /** What the three reels show when they are not turning. */
  reels: Reels = [7, 3, 5];
  heldSpins = 0;
  lights = 0;
  /** Seconds left of the bonus-strip celebration. */
  bonusFlash = 0;
  private spin: Spin | null = null;
  private rest = 0;
  private jackpot: Jackpot | null = null;
  private pendingJackpotRounds = 0;
  private owed = 0;
  private trickle = 0;
  private readonly open = new Map<string, boolean>();
  /** Balls paid for every ball caught; the player chooses it in Settings. */
  payout = 5;

  constructor(
    private readonly events: MachineEvents = {},
    private readonly random: () => number = Math.random,
  ) {}

  isOpen(id: string): boolean {
    return this.open.get(id) ?? false;
  }

  /** How many reels have stopped in the current spin (3 when idle). */
  get reelsStopped(): number {
    return this.spin ? this.spin.stopped : 3;
  }

  get spinning(): boolean {
    return this.spin !== null;
  }

  get inReach(): boolean {
    return this.spin !== null && this.spin.reach && this.spin.stopped === 2;
  }

  /** The current jackpot round and the total, or null outside a jackpot. */
  get jackpotRound(): { round: number; rounds: number; open: boolean; caught: number } | null {
    const j = this.jackpot;
    return j ? { round: j.round, rounds: j.rounds, open: j.open, caught: j.caught } : null;
  }

  /** Balls won but not yet trickled into the tray. */
  get owedBalls(): number {
    return this.owed;
  }

  /** True while anything is still playing out (so the game is not over yet). */
  get busy(): boolean {
    return this.spin !== null || this.heldSpins > 0 || this.jackpot !== null || this.pendingJackpotRounds > 0 || this.owed > 0;
  }

  /** A ball was caught. */
  catch(pocket: Pocket): void {
    const pay = this.payout;
    this.owed += pay;
    this.events.onWin?.(pocket, pay);

    switch (pocket.kind) {
      case 'start':
        if (this.heldSpins < RULES.maxHeldSpins) this.heldSpins++;
        break;
      case 'tulip': {
        // Traditional tulip: a catch flips it, and may open its partner.
        this.setTulip(pocket.id, !this.isOpen(pocket.id));
        if (pocket.opens !== null) this.setTulip(pocket.opens, true);
        this.light();
        break;
      }
      case 'side':
        break;
      case 'attacker': {
        const j = this.jackpot;
        if (j?.open) {
          j.caught++;
          if (j.caught >= RULES.jackpot.catchesPerRound) this.endRound(j);
        }
        break;
      }
    }
  }

  /** Advance time. Returns how many won balls dropped into the tray during it. */
  update(dt: number): number {
    if (this.bonusFlash > 0) this.bonusFlash = Math.max(0, this.bonusFlash - dt);
    this.updateJackpot(dt);
    this.updateReels(dt);

    this.trickle += dt * RULES.payoutRate;
    const paid = Math.min(this.owed, Math.floor(this.trickle));
    this.trickle = this.owed - paid > 0 ? this.trickle - paid : 0;
    this.owed -= paid;
    return paid;
  }

  private setTulip(id: string, open: boolean): void {
    if (this.isOpen(id) === open) return;
    this.open.set(id, open);
    this.events.onTulip?.(id, open);
  }

  private light(): void {
    if (this.bonusFlash > 0) return;
    this.lights++;
    if (this.lights >= RULES.bonus.lights) {
      this.lights = 0;
      this.bonusFlash = RULES.bonus.flashSeconds;
      this.owed += RULES.bonus.payMultiple * this.payout;
      this.events.onBonus?.();
    }
  }

  /** A random symbol, optionally different from `not`. */
  private pick(not?: number): number {
    const s = 1 + Math.min(RULES.symbols - 1, Math.floor(this.random() * RULES.symbols));
    return s === not ? (s % RULES.symbols) + 1 : s;
  }

  private startSpin(): void {
    this.heldSpins--;
    const jackpot = this.random() < RULES.jackpotChance;
    const reach = jackpot || this.random() < RULES.reachChance;
    const first = this.pick();
    const result: Reels = jackpot ? [first, first, first] : reach ? [first, first, this.pick(first)] : [first, this.pick(first), this.pick()];
    const end = RULES.reelStops[2] + (reach ? RULES.reachExtra : 0);
    this.spin = { result, reach, jackpot, time: 0, stopped: 0, end };
    this.events.onSpinStart?.();
  }

  private updateReels(dt: number): void {
    const spin = this.spin;
    if (!spin) {
      if (this.rest > 0) {
        this.rest -= dt;
        if (this.rest > 0) return;
        if (this.pendingJackpotRounds > 0) {
          this.beginJackpot(this.pendingJackpotRounds);
          this.pendingJackpotRounds = 0;
        }
      }
      // The reels rest during a jackpot; held spins play once it is over.
      if (this.heldSpins > 0 && !this.jackpot) this.startSpin();
      return;
    }
    spin.time += dt;
    while (spin.stopped < 3) {
      const at = spin.stopped === 2 ? spin.end : RULES.reelStops[spin.stopped]!;
      if (spin.time < at) break;
      const reel = spin.stopped++;
      this.reels[reel] = spin.result[reel]!;
      this.events.onReelStop?.(reel, spin.result[reel]!);
      if (reel === 1 && spin.reach) this.events.onReach?.();
    }
    if (spin.stopped === 3) {
      this.spin = null;
      this.rest = RULES.afterSpin;
      if (spin.jackpot) {
        this.pendingJackpotRounds = spin.result[0] === 7 ? RULES.jackpot.luckySevenRounds : RULES.jackpot.rounds;
      }
    }
  }

  private beginJackpot(rounds: number): void {
    this.jackpot = { round: 1, rounds, caught: 0, timer: RULES.jackpot.roundSeconds, open: true };
    this.events.onJackpot?.(rounds);
    this.events.onRound?.(1, rounds);
    this.events.onAttacker?.(true);
  }

  private endRound(j: Jackpot): void {
    j.open = false;
    j.timer = RULES.jackpot.pause;
    this.events.onAttacker?.(false);
  }

  private updateJackpot(dt: number): void {
    const j = this.jackpot;
    if (!j) return;
    j.timer -= dt;
    if (j.timer > 0) return;
    if (j.open) {
      this.endRound(j);
    } else if (j.round >= j.rounds) {
      this.jackpot = null;
      this.events.onJackpotEnd?.();
    } else {
      j.round++;
      j.caught = 0;
      j.open = true;
      j.timer = RULES.jackpot.roundSeconds;
      this.events.onRound?.(j.round, j.rounds);
      this.events.onAttacker?.(true);
    }
  }
}
