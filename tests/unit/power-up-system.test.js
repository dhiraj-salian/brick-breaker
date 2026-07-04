import { describe, it, expect } from 'vitest';
import { applyPowerUp, tickEffects, powerUpColor } from '../../src/core/power-up-system.js';
import { POWER_UP_TYPE } from '../../src/core/constants.js';

describe('power-up-system', () => {
  it('applyPowerUp(EXPAND_PADDLE) widens paddle.targetWidth', () => {
    const s = { paddle: { width: 2.4, targetWidth: 2.4 }, activeEffects: [] };
    const out = applyPowerUp(s, POWER_UP_TYPE.EXPAND_PADDLE);
    expect(out.paddle.targetWidth).toBeGreaterThan(2.4);
  });

  it('applyPowerUp adds to activeEffects for timed types', () => {
    const s = { paddle: { width: 2.4, targetWidth: 2.4 }, activeEffects: [] };
    const out = applyPowerUp(s, POWER_UP_TYPE.SLOW_BALL);
    expect(out.activeEffects.some((e) => e.type === POWER_UP_TYPE.SLOW_BALL)).toBe(true);
  });

  it('applyPowerUp replaces existing same-type effect (no duplicates)', () => {
    let s = { paddle: { width: 2.4, targetWidth: 2.4 }, activeEffects: [] };
    s = applyPowerUp(s, POWER_UP_TYPE.SLOW_BALL);
    s = applyPowerUp(s, POWER_UP_TYPE.SLOW_BALL);
    const slowCount = s.activeEffects.filter((e) => e.type === POWER_UP_TYPE.SLOW_BALL).length;
    expect(slowCount).toBe(1);
  });

  it('tickEffects decrements remaining time', () => {
    const s = {
      paddle: { width: 2.4, targetWidth: 3.6 },
      activeEffects: [{ type: POWER_UP_TYPE.EXPAND_PADDLE, remaining: 5 }],
    };
    const out = tickEffects(s, 0.5);
    expect(out.activeEffects[0].remaining).toBeCloseTo(4.5, 5);
  });

  it('tickEffects reverts paddle width when EXPAND expires', () => {
    const s = {
      paddle: { width: 3.6, targetWidth: 3.6 },
      activeEffects: [{ type: POWER_UP_TYPE.EXPAND_PADDLE, remaining: 0.1 }],
    };
    const out = tickEffects(s, 0.5);
    expect(out.paddle.targetWidth).toBe(2.4);
    expect(out.activeEffects).toHaveLength(0);
  });

  it('powerUpColor returns a number for known types', () => {
    expect(typeof powerUpColor(POWER_UP_TYPE.MULTI_BALL)).toBe('number');
  });

  it('applyPowerUp on unknown type is no-op (returns equivalent state)', () => {
    const s = { paddle: { width: 2.4, targetWidth: 2.4 }, activeEffects: [] };
    const out = applyPowerUp(s, 'unknown');
    expect(out.paddle.targetWidth).toBe(2.4);
    expect(out.activeEffects).toHaveLength(0);
  });
});
