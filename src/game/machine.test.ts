import { describe, expect, it } from 'vitest';
import type { Pocket } from '../board/types';
import { Machine, RULES, type MachineEvents } from './machine';

const pocket = (id: string, kind: Pocket['kind'], opens: string | null = null): Pocket => ({ id, kind, x: 0, y: 0, halfWidth: 20, opens });
const START = pocket('start', 'start');
const SIDE = pocket('side', 'side');
const UPPER = pocket('upper', 'tulip', 'lower');
const LOWER = pocket('lower', 'tulip');
const ATTACKER = pocket('attacker', 'attacker');

/** A random source that plays back a list, then repeats its last value. */
function scripted(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
}

function run(m: Machine, seconds: number): number {
  let paid = 0;
  for (let t = 0; t < seconds; t += 1 / 60) paid += m.update(1 / 60);
  return paid;
}

describe('Machine', () => {
  it('pays the chosen number of balls for every catch, trickled into the tray', () => {
    const m = new Machine();
    m.payout = 10;
    m.catch(SIDE);
    expect(m.owedBalls).toBe(10);
    expect(run(m, 0.1)).toBeLessThan(10);
    expect(run(m, 2)).toBeGreaterThan(0);
    expect(m.owedBalls).toBe(0);

    m.payout = 25;
    m.catch(SIDE);
    expect(run(m, 3)).toBe(25);
    expect(m.busy).toBe(false);
  });

  it('flips a tulip on each catch and opens its partner', () => {
    const log: string[] = [];
    const m = new Machine({ onTulip: (id, open) => log.push(`${id}:${open}`) });
    m.catch(UPPER);
    expect(m.isOpen('upper')).toBe(true);
    expect(m.isOpen('lower')).toBe(true);
    m.catch(UPPER);
    expect(m.isOpen('upper')).toBe(false);
    expect(m.isOpen('lower')).toBe(true);
    m.catch(LOWER);
    expect(m.isOpen('lower')).toBe(false);
    expect(log).toEqual(['upper:true', 'lower:true', 'upper:false', 'lower:false']);
  });

  it('spins the reels for a start catch and holds at most four spins', () => {
    // Never a jackpot or a reach.
    const m = new Machine({}, scripted([0.99, 0.99, 0.1, 0.5, 0.9]));
    for (let i = 0; i < 7; i++) m.catch(START);
    expect(m.heldSpins).toBe(RULES.maxHeldSpins);
    run(m, 0.05);
    expect(m.spinning).toBe(true);
    expect(m.heldSpins).toBe(RULES.maxHeldSpins - 1);
    expect(m.reelsStopped).toBe(0);
    run(m, 1);
    expect(m.reelsStopped).toBe(1);
    run(m, 30);
    expect(m.spinning).toBe(false);
    expect(m.heldSpins).toBe(0);
    expect(m.jackpotRound).toBeNull();
    // An ordinary losing spin never shows a matching first pair.
    expect(m.reels[0]).not.toBe(m.reels[1]);
  });

  it('teases with a reach: two the same, a long wait, then a miss', () => {
    const events: string[] = [];
    const m = new Machine({ onReach: () => events.push('reach'), onJackpot: () => events.push('jackpot') }, scripted([0.99, 0, 0.3, 0.3, 0.8]));
    m.catch(START);
    run(m, RULES.reelStops[1] + 0.1);
    expect(m.inReach).toBe(true);
    expect(m.reels[0]).toBe(m.reels[1]);
    run(m, RULES.reelStops[2] - RULES.reelStops[1]);
    expect(m.spinning).toBe(true);
    run(m, RULES.reachExtra + 1);
    expect(m.spinning).toBe(false);
    expect(m.reels[2]).not.toBe(m.reels[0]);
    expect(events).toEqual(['reach']);
  });

  function jackpotMachine(events: MachineEvents = {}, firstSymbol = 0.2): Machine {
    const m = new Machine(events, scripted([0, firstSymbol]));
    m.catch(START);
    run(m, RULES.reelStops[2] + RULES.reachExtra + RULES.afterSpin + 0.2);
    return m;
  }

  it('opens the attacker for five rounds on three of a kind', () => {
    const log: string[] = [];
    const m = jackpotMachine({ onAttacker: (open) => log.push(open ? 'open' : 'shut'), onJackpotEnd: () => log.push('end') });
    expect(m.reels[0]).toBe(m.reels[1]);
    expect(m.reels[1]).toBe(m.reels[2]);
    expect(m.jackpotRound).toMatchObject({ round: 1, rounds: RULES.jackpot.rounds, open: true });

    // Eight catches end a round early.
    m.payout = 5;
    for (let i = 0; i < RULES.jackpot.catchesPerRound; i++) m.catch(ATTACKER);
    expect(m.jackpotRound?.open).toBe(false);
    run(m, RULES.jackpot.pause + 0.1);
    expect(m.jackpotRound).toMatchObject({ round: 2, open: true });

    // Otherwise a round runs out of time. Spins wait until the jackpot is over.
    m.catch(START);
    run(m, (RULES.jackpot.roundSeconds + RULES.jackpot.pause) * RULES.jackpot.rounds);
    expect(m.jackpotRound).toBeNull();
    expect(log.filter((e) => e === 'open')).toHaveLength(RULES.jackpot.rounds);
    expect(log.at(-1)).toBe('end');
    expect(m.busy).toBe(false);
  });

  it('gives extra rounds for three sevens', () => {
    expect(jackpotMachine({}, 0.99).jackpotRound?.rounds).toBe(RULES.jackpot.luckySevenRounds);
  });

  it('ignores the attacker outside a jackpot round apart from paying', () => {
    const m = new Machine();
    m.catch(ATTACKER);
    expect(m.owedBalls).toBe(m.payout);
    expect(m.jackpotRound).toBeNull();
  });

  it('lights the bonus strip with tulip catches and pays when it fills', () => {
    let bonuses = 0;
    const m = new Machine({ onBonus: () => bonuses++ });
    m.payout = 10;
    for (let i = 0; i < RULES.bonus.lights - 1; i++) m.catch(LOWER);
    expect(m.lights).toBe(RULES.bonus.lights - 1);
    expect(bonuses).toBe(0);
    m.catch(SIDE);
    expect(m.lights).toBe(RULES.bonus.lights - 1);
    m.catch(LOWER);
    expect(bonuses).toBe(1);
    expect(m.lights).toBe(0);
    expect(m.bonusFlash).toBeGreaterThan(0);
    expect(m.owedBalls).toBe((RULES.bonus.lights + 1 + RULES.bonus.payMultiple) * 10);
  });
});
