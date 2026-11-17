import { describe, expect, it } from 'vitest';
import type { Pocket } from '../board/types';
import { Machine, RULES } from './machine';

const TULIPS = ['upper-left', 'upper-right', 'lower-left', 'lower-right'];
const pocket = (id: string, kind: Pocket['kind'], opens: string[] = []): Pocket => ({ id, kind, x: 0, y: 0, halfWidth: 20, opens });
const SIDE = pocket('side', 'side');
const TULIP = pocket('upper-left', 'tulip');
const CROWN = pocket('crown', 'crown', TULIPS);
const CHIN = pocket('chin', 'chin', TULIPS);
const PAW = pocket('paw-left', 'paw', ['upper-left', 'lower-left']);

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
    expect(m.busy).toBe(true);
    expect(run(m, 3)).toBe(25);
    expect(m.busy).toBe(false);
  });

  it('flips a tulip open and shut with each catch', () => {
    const log: string[] = [];
    const m = new Machine({ onTulip: (id, open) => log.push(`${id}:${open}`) });
    m.catch(TULIP);
    expect(m.isOpen('upper-left')).toBe(true);
    m.catch(TULIP);
    expect(m.isOpen('upper-left')).toBe(false);
    expect(log).toEqual(['upper-left:true', 'upper-left:false']);
  });

  it('opens every tulip for a ball in the top of the tiger\'s head or under his chin', () => {
    for (const entrance of [CROWN, CHIN]) {
      const opened: string[] = [];
      let told = 0;
      const m = new Machine({ onTulip: (id, open) => open && opened.push(id), onTiger: (_p, n) => (told = n) });
      m.catch(entrance);
      expect(opened.sort()).toEqual([...TULIPS].sort());
      expect(TULIPS.every((id) => m.isOpen(id))).toBe(true);
      expect(told).toBe(4);
      expect(m.owedBalls).toBe(m.payout);
    }
  });

  it('opens the two tulips on its side for a ball in a paw, leaving open ones open', () => {
    const m = new Machine();
    m.catch(PAW);
    expect(m.isOpen('upper-left')).toBe(true);
    expect(m.isOpen('lower-left')).toBe(true);
    expect(m.isOpen('upper-right')).toBe(false);
    expect(m.isOpen('lower-right')).toBe(false);
    m.catch(PAW);
    expect(m.isOpen('upper-left')).toBe(true);
  });

  it('makes the tiger happy for a moment when a ball finds him', () => {
    const m = new Machine();
    m.catch(SIDE);
    expect(m.cheer).toBe(0);
    m.catch(PAW);
    expect(m.cheer).toBeGreaterThan(0);
    run(m, RULES.cheerSeconds + 0.1);
    expect(m.cheer).toBe(0);
  });

  it('lights the bonus strip with tulip catches and pays when it fills', () => {
    let bonuses = 0;
    const m = new Machine({ onBonus: () => bonuses++ });
    m.payout = 10;
    for (let i = 0; i < RULES.bonus.lights - 1; i++) m.catch(TULIP);
    expect(m.lights).toBe(RULES.bonus.lights - 1);
    expect(bonuses).toBe(0);
    m.catch(SIDE);
    m.catch(PAW);
    expect(m.lights).toBe(RULES.bonus.lights - 1);
    m.catch(TULIP);
    expect(bonuses).toBe(1);
    expect(m.lights).toBe(0);
    expect(m.bonusFlash).toBeGreaterThan(0);
    expect(m.owedBalls).toBe((RULES.bonus.lights + 2 + RULES.bonus.payMultiple) * 10);
  });
});
