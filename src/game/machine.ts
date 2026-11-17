import type { Pocket } from '../board/types';

/**
 * The rules of the machine: what a catch pays and what it sets off. Knows nothing about
 * physics, drawing or sound; it is told about catches and the passing of time, and reports
 * what happened through `MachineEvents`.
 */
export const RULES = {
  /** Each tulip catch lights one bulb of the strip; a full strip pays a bonus. */
  bonus: { lights: 9, payMultiple: 2, flashSeconds: 2 },
  /** Winnings trickle into the tray at this many balls per second, like a real payout. */
  payoutRate: 28,
  /** How long the tiger looks pleased after a ball finds him. */
  cheerSeconds: 2.2,
} as const;

export interface MachineEvents {
  onTulip?(id: string, open: boolean): void;
  /** The tiger caught a ball and opened `tulips` tulips (some may have been open already). */
  onTiger?(pocket: Pocket, tulips: number): void;
  onBonus?(): void;
  onWin?(pocket: Pocket, balls: number): void;
}

export class Machine {
  lights = 0;
  /** Seconds left of the bonus-strip celebration. */
  bonusFlash = 0;
  /** Seconds left of the tiger's happy face. */
  cheer = 0;
  /** Balls paid for every ball caught; the player chooses it in Settings. */
  payout = 5;
  private owed = 0;
  private trickle = 0;
  private readonly open = new Map<string, boolean>();

  constructor(private readonly events: MachineEvents = {}) {}

  isOpen(id: string): boolean {
    return this.open.get(id) ?? false;
  }

  /** Balls won but not yet trickled into the tray. */
  get owedBalls(): number {
    return this.owed;
  }

  /** True while winnings are still on their way (so the game is not over yet). */
  get busy(): boolean {
    return this.owed > 0;
  }

  /** A ball was caught. */
  catch(pocket: Pocket): void {
    const pay = this.payout;
    this.owed += pay;
    this.events.onWin?.(pocket, pay);

    if (pocket.kind === 'tulip') {
      // Traditional tulip: a catch flips it open or shut.
      this.setTulip(pocket.id, !this.isOpen(pocket.id));
      this.light();
    }
    if (pocket.opens.length > 0) {
      for (const id of pocket.opens) this.setTulip(id, true);
      this.cheer = RULES.cheerSeconds;
      this.events.onTiger?.(pocket, pocket.opens.length);
    }
  }

  /** Advance time. Returns how many won balls dropped into the tray during it. */
  update(dt: number): number {
    if (this.bonusFlash > 0) this.bonusFlash = Math.max(0, this.bonusFlash - dt);
    if (this.cheer > 0) this.cheer = Math.max(0, this.cheer - dt);

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
}
