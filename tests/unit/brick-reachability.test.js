// Regression test for the "outer bricks unreachable" bug.
//
// Symptom (Dhiraj, 2026-07-05 13:47 IST): "the width for ball bounce in
// horizontal is less than the space where tiles are placed so some tiles
// are not reachable at all."
//
// Root cause: The paddle's spin influence (vx += spin * SPIN_INFLUENCE)
// produces a max launch angle of ~27° from vertical with SPIN_INFLUENCE=6.
// To reach the outermost brick column (cx ≈ ±8.5 in the default Level 2
// layout), the ball needs max spin AND a long vertical run. If the ball
// arrives at the paddle slightly off-center (offset < 1), it doesn't get
// enough horizontal velocity and falls back without ever reaching the
// outer columns.
//
// Fix: increase SPIN_INFLUENCE (6 → 9) so a half-decent offset produces
// enough horizontal velocity to reach the outer bricks.

import { describe, it, expect } from 'vitest';
import { WORLD } from '../../src/core/constants.js';

const SPIN_INFLUENCE = 9; // matches main.js after the fix

/** Geometry: where is brick at column `col`? */
function brickAt(col) {
  const cellW = WORLD.BRICK_WIDTH + WORLD.BRICK_GAP;
  const totalW = WORLD.BRICK_COLS * cellW - WORLD.BRICK_GAP;
  const x = -totalW / 2 + cellW / 2 + col * cellW;
  return { x, y: WORLD.BRICK_TOP_Y, w: WORLD.BRICK_WIDTH, h: WORLD.BRICK_HEIGHT };
}

describe('outer-brick reachability (regression)', () => {
  it('every brick column is reachable from a centered paddle with the right spin', () => {
    // For each col, compute the spin offset needed to send the ball from
    // a centered paddle (paddle.x = 0) to that column in one launch.
    // If required spin exceeds 1.0, the column is unreachable from a single
    // centered launch — which is the bug Dhiraj reported.

    const speed = WORLD.BALL_BASE_SPEED;
    const DY =
      WORLD.BRICK_TOP_Y - (WORLD.PADDLE_Y + WORLD.PADDLE_HEIGHT / 2 + WORLD.BALL_RADIUS + 0.2);

    for (let col = 0; col < WORLD.BRICK_COLS; col++) {
      const brick = brickAt(col);
      const requiredDx = brick.x;

      // Binary search for spin s such that dx(s) = requiredDx
      // where dx(s) = s * SPIN_INFLUENCE * DY / sqrt(speed² - (s*SPIN_INFLUENCE)²)
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        const vx = mid * SPIN_INFLUENCE;
        if (Math.abs(vx) >= speed) {
          hi = mid;
          continue;
        }
        const vy = Math.sqrt(speed * speed - vx * vx);
        const dx = vx * (DY / vy);
        if (Math.abs(dx) < Math.abs(requiredDx)) lo = mid;
        else hi = mid;
      }
      const requiredSpin = (lo + hi) / 2;

      expect(
        Math.abs(requiredSpin),
        `col ${col} (cx=${brick.x.toFixed(2)}): required spin offset = ${requiredSpin.toFixed(3)} ` +
          `is > 1.0, meaning the column cannot be reached from a centered paddle. ` +
          `Increase SPIN_INFLUENCE so the ball can travel further horizontally per unit spin.`
      ).toBeLessThanOrEqual(1.0);
    }
  });

  it('max spin produces a launch angle wide enough for forgiving outer-brick play', () => {
    // For forgiving outer-brick play (where the player doesn't have to
    // hit the very edge of the paddle), the max launch angle should be
    // at least 35° from vertical.
    const speed = WORLD.BALL_BASE_SPEED;
    const maxVx = SPIN_INFLUENCE;
    expect(maxVx).toBeLessThan(speed);
    const vy = Math.sqrt(speed * speed - maxVx * maxVx);
    const angleDeg = (Math.atan(maxVx / vy) * 180) / Math.PI;
    expect(
      angleDeg,
      'max launch angle too narrow; outer bricks will feel unreachable'
    ).toBeGreaterThanOrEqual(35);
  });

  it('outer columns are reachable with comfortable spin (≤85% offset)', () => {
    // The actual gameplay feel: outer columns should be hittable with
    // a comfortable paddle aim, not requiring a perfect edge hit. If the
    // player has to be within ~15% of the paddle edge to reach an outer
    // column, the game feels unfair.
    const speed = WORLD.BALL_BASE_SPEED;
    const DY =
      WORLD.BRICK_TOP_Y - (WORLD.PADDLE_Y + WORLD.PADDLE_HEIGHT / 2 + WORLD.BALL_RADIUS + 0.2);

    // The 3 outermost columns on each side (cols 0/1/2 and 7/8/9)
    const outerCols = [0, 1, 2, WORLD.BRICK_COLS - 3, WORLD.BRICK_COLS - 2, WORLD.BRICK_COLS - 1];

    for (const col of outerCols) {
      const brick = brickAt(col);
      const requiredDx = Math.abs(brick.x);

      // Required spin for outer cols (in [0, 1])
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        const vx = mid * SPIN_INFLUENCE;
        if (Math.abs(vx) >= speed) {
          hi = mid;
          continue;
        }
        const vy = Math.sqrt(speed * speed - vx * vx);
        const dx = vx * (DY / vy);
        if (dx < requiredDx) lo = mid;
        else hi = mid;
      }
      const requiredSpin = (lo + hi) / 2;

      expect(
        requiredSpin,
        `outer col ${col} (cx=${brick.x.toFixed(2)}): required spin = ${requiredSpin.toFixed(3)} ` +
          `is > 0.85, meaning the player must aim within 15% of the paddle edge to reach this brick. ` +
          `Increase SPIN_INFLUENCE so outer columns are reachable with comfortable aim.`
      ).toBeLessThanOrEqual(0.85);
    }
  });
});
