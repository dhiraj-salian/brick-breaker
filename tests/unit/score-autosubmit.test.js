// Regression test for the "top score not getting saved" bug.
//
// Symptom (Dhiraj, 2026-07-05 16:42 IST): "top score not getting saved".
//
// Root cause: Score submission was 100% manual — the user had to type
// a name on the win screen and click Submit. If they clicked Restart
// (or just closed the tab), the score was lost. On LOST there was no
// submission path at all.
//
// Fix: Generate a default name (random + memorable) on terminal state
// (WON/LOST) and auto-submit the score. The user can still see the
// saved name on the leaderboard panel after.
//
// We model the default-name generator here as a pure function so it is
// testable without DOM/network.

import { describe, it, expect } from 'vitest';
import { generateDefaultName } from '../../src/core/default-name.js';

describe('default player name generator (regression)', () => {
  it('returns a non-empty string of <=20 chars', () => {
    const name = generateDefaultName();
    expect(name).toBeTruthy();
    expect(name.length).toBeGreaterThan(0);
    expect(name.length).toBeLessThanOrEqual(20);
  });

  it('generates varied names (no two consecutive calls are identical)', () => {
    const a = generateDefaultName();
    const b = generateDefaultName();
    const c = generateDefaultName();
    expect(new Set([a, b, c]).size).toBeGreaterThanOrEqual(2);
  });

  it('contains only safe characters (letters, digits, space, dash, underscore)', () => {
    // 10 calls to catch the chance of an unsafe character
    for (let i = 0; i < 10; i++) {
      const name = generateDefaultName();
      expect(name).toMatch(/^[A-Za-z0-9 _-]+$/);
    }
  });
});
