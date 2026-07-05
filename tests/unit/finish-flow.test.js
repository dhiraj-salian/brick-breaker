// Regression test for the "game gets stuck on finishing" bug.
//
// Symptom (Dhiraj, 2026-07-05 16:42 IST): "the game gets stuck on
// finishing".
//
// Root cause: After clearing the final brick, the win-condition code
// sets state.status = WON. But the ball continues to exist (and fly
// through empty space) — there is no logic to clear balls on WIN/LOST.
// Combined with the layout bug (worldWidth drift), the ball can fly
// around outside the visible play area for many seconds, looking
// frozen. Worse: if the ball drops below LOSE_Y mid-win-transition,
// the reattach logic decrements a life (lives went from 3 → 2) even
// though the game is already over.
//
// Fix: state must have a clear "balls cleared on terminal status" rule.
// When status becomes WON or LOST, all balls should be removed so the
// scene visibly stops moving.

import { describe, it, expect } from 'vitest';
import { STATUS } from '../../src/core/constants.js';
import { createInitialState, winGame, loseLife } from '../../src/core/game-state.js';

describe('finish-flow: game does not get stuck (regression)', () => {
  it('winGame clears remaining balls', () => {
    const s = {
      ...createInitialState(),
      status: STATUS.PLAYING,
      balls: [{ x: 0, y: 5, vx: 1, vy: -2, r: 0.3 }],
    };
    const out = winGame(s);
    expect(out.status).toBe(STATUS.WON);
    expect(out.balls).toEqual([]);
  });

  it('loseLife to LOST clears remaining balls', () => {
    const s = {
      ...createInitialState(),
      status: STATUS.PLAYING,
      lives: 1,
      balls: [{ x: 0, y: 5, vx: 1, vy: -2, r: 0.3 }],
    };
    const out = loseLife(s);
    expect(out.status).toBe(STATUS.LOST);
    expect(out.balls).toEqual([]);
  });

  it('loseLife when lives remain does NOT clear balls (player continues)', () => {
    const s = {
      ...createInitialState(),
      status: STATUS.PLAYING,
      lives: 2,
      balls: [{ x: 0, y: 5, vx: 1, vy: -2, r: 0.3 }],
    };
    const out = loseLife(s);
    expect(out.status).toBe(STATUS.PLAYING);
    expect(out.lives).toBe(1);
    expect(out.balls.length).toBe(1);
  });
});
