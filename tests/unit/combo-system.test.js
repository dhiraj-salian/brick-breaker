import { describe, it, expect } from 'vitest';
import { registerHit, tickCombo, resetCombo } from '../../src/core/combo-system.js';
import { COMBO_MAX, COMBO_WINDOW_SEC } from '../../src/core/constants.js';

describe('combo-system', () => {
  it('registerHit increments combo and sets timer', () => {
    const s = { combo: 1, comboTimer: 0 };
    const out = registerHit(s);
    expect(out.combo).toBe(2);
    expect(out.comboTimer).toBe(COMBO_WINDOW_SEC);
  });

  it('registerHit clamps combo at COMBO_MAX', () => {
    const s = { combo: COMBO_MAX, comboTimer: 0 };
    const out = registerHit(s);
    expect(out.combo).toBe(COMBO_MAX);
  });

  it('tickCombo decrements timer', () => {
    const s = { combo: 3, comboTimer: 1.0 };
    const out = tickCombo(s, 0.5);
    expect(out.comboTimer).toBeCloseTo(0.5, 5);
    expect(out.combo).toBe(3); // still in window
  });

  it('tickCombo resets combo to 1 when timer expires', () => {
    const s = { combo: 5, comboTimer: 0.1 };
    const out = tickCombo(s, 0.5);
    expect(out.comboTimer).toBe(0);
    expect(out.combo).toBe(1);
  });

  it('tickCombo is a no-op when timer already 0', () => {
    const s = { combo: 3, comboTimer: 0 };
    expect(tickCombo(s, 0.1)).toBe(s);
  });

  it('resetCombo zeroes combo', () => {
    const s = { combo: 5, comboTimer: 1 };
    const out = resetCombo(s);
    expect(out.combo).toBe(1);
    expect(out.comboTimer).toBe(0);
  });
});
