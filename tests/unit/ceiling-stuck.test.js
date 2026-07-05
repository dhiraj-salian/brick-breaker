// Regression test for the "ball stuck at ceiling" bug.
//
// Root cause: `detectPaddleCollision` passed the paddle object directly
// to `circleAabbHit`, which expects `{x, y, w, h}`. The paddle only had
// `{x, y, width, ...}`, so `circleAabbHit` did math with NaN and the
// comparison `distSq > r*r` evaluated to false — returning a phantom hit
// for every frame. The paddle-hit handler in main.js then re-bounced
// the ball with `bounceBall(_, 0, 1, _)` which set vy = +|vy| (positive,
// toward the ceiling). The result: after touching the ceiling, the ball
// was flipped back up every frame and stuck at y=9.7 forever.
//
// This integration test simulates the full physics + collision loop and
// verifies the ball eventually returns from the ceiling to the paddle.
import { describe, it, expect } from 'vitest';
import { stepPhysics } from '../../src/core/physics-stepper.js';
import {
  detectBrickCollisions,
  detectPaddleCollision,
  bounceBall,
  safeNormalize,
} from '../../src/core/collision-detector.js';
import { WORLD } from '../../src/core/constants.js';

const dt = 1 / WORLD.STEP_HZ;

function baseState() {
  return {
    paddle: {
      x: 0,
      y: WORLD.PADDLE_Y,
      width: WORLD.PADDLE_WIDTH,
      targetWidth: WORLD.PADDLE_WIDTH,
      targetX: 0,
    },
    balls: [],
    bricks: [],
    worldWidth: 14,
    shake: { intensity: 0 },
    flash: 0,
  };
}

// Mirrors the relevant slice of physicsStep() in src/main.js.
function physicsStep(state) {
  state = stepPhysics(state, dt);

  // Brick collisions
  const brickEvents = detectBrickCollisions(state);
  for (const ev of brickEvents) {
    const idx = state.balls.indexOf(ev.ball);
    if (idx >= 0) {
      const speed = Math.hypot(ev.ball.vx, ev.ball.vy);
      state.balls[idx] = bounceBall(ev.ball, ev.nx, ev.ny, speed);
    }
    if (ev.brick.type !== 'unbreakable') {
      ev.brick.hp -= 1;
      if (ev.brick.hp <= 0) ev.brick.broken = true;
    }
  }

  // Paddle collisions
  for (const ball of state.balls) {
    const hit = detectPaddleCollision(ball, state.paddle);
    if (hit) {
      const idx = state.balls.indexOf(ball);
      if (idx >= 0) {
        const speed = Math.hypot(ball.vx, ball.vy);
        const bounced = bounceBall(ball, 0, 1, Math.max(speed, WORLD.BALL_BASE_SPEED));
        bounced.vx += hit.spin * 6;
        const norm = safeNormalize(bounced.vx, bounced.vy, WORLD.BALL_BASE_SPEED);
        bounced.vx = norm.vx;
        bounced.vy = norm.vy;
        if (bounced.vy < 0) bounced.vy = -bounced.vy;
        state.balls[idx] = bounced;
      }
    }
  }

  // Drop balls below lose line (matches stepPhysics behavior)
  state.balls = state.balls.filter((b) => b.y > WORLD.LOSE_Y);

  return state;
}

describe('ceiling-stuck bug regression', () => {
  it('ball that touches ceiling eventually returns to the lower half of the world', () => {
    let state = baseState();
    // Launch ball straight up at base speed.
    state.balls = [{ x: 0, y: 0, vx: 0, vy: WORLD.BALL_BASE_SPEED, r: WORLD.BALL_RADIUS }];

    let touchedCeiling = false;
    for (let f = 0; f < 300; f++) {
      const before = state.balls[0];
      if (!before) break;
      if (before.y + before.r >= WORLD.HEIGHT / 2 - 0.01) touchedCeiling = true;
      state = physicsStep(state);
      const after = state.balls[0];
      if (!after) break;
      // The bug manifested as the ball getting pinned at y = halfH - r with vy > 0.
      // After the fix, once the ball has touched the ceiling, it must come back down.
      if (touchedCeiling && after.y < -2) {
        // Ball successfully returned from ceiling into lower half.
        expect(after.y).toBeLessThan(-2);
        return;
      }
    }
    // If we get here without returning, the bug is back.
    expect(touchedCeiling).toBe(true);
    const final = state.balls[0];
    if (final) {
      expect(final.y).toBeLessThan(-2);
    }
  });

  it('ball does not get pinned at ceiling across many frames', () => {
    let state = baseState();
    state.balls = [{ x: 0, y: 9, vx: 2, vy: 12, r: WORLD.BALL_RADIUS }];

    let framesAtCeiling = 0;
    for (let f = 0; f < 120; f++) {
      state = physicsStep(state);
      const b = state.balls[0];
      if (!b) break;
      const atCeiling = Math.abs(b.y - (WORLD.HEIGHT / 2 - WORLD.BALL_RADIUS)) < 0.01;
      if (atCeiling) {
        framesAtCeiling++;
        // If ball is at ceiling with positive vy, the bug has returned.
        expect(b.vy).toBeLessThan(0);
      }
    }
    // Ball should not be stuck at ceiling for more than ~10 frames in a row.
    expect(framesAtCeiling).toBeLessThan(20);
  });
});
