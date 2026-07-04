import { COMBO_MAX } from './constants.js';

/**
 * Score calculator — pure function.
 *
 * Formula:  total = (base * clamp(combo, 1, COMBO_MAX)) + bonuses
 *
 * @param {object} input
 * @param {number} input.base      base points from brick type
 * @param {number} input.combo     current combo multiplier (>= 1)
 * @param {number} input.bonuses   flat bonuses (e.g. power-ups, level clear)
 * @returns {number} computed score
 */
export function calculateScore({ base, combo, bonuses }) {
  const multiplier = Math.max(1, Math.min(combo, COMBO_MAX));
  return base * multiplier + bonuses;
}
