import { COMBO_WINDOW_SEC, COMBO_MAX } from './constants.js';

/**
 * Combo system — increments combo on a hit, decays timer each step.
 * Pure functions; state.timer is in seconds.
 */

export function registerHit(state) {
  const next = Math.min(state.combo + 1, COMBO_MAX);
  return { ...state, combo: next, comboTimer: COMBO_WINDOW_SEC };
}

export function tickCombo(state, dt) {
  if (state.comboTimer <= 0) return state;
  const timer = state.comboTimer - dt;
  if (timer <= 0) {
    return { ...state, comboTimer: 0, combo: 1 };
  }
  return { ...state, comboTimer: timer };
}

export function resetCombo(state) {
  return { ...state, combo: 1, comboTimer: 0 };
}
