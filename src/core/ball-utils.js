import { WORLD } from './constants.js';

/**
 * Ball utility helpers — shared between physics, collision, and rendering.
 *
 * The breakout-style "stuck ball" failure mode is when a ball loses too much
 * energy from repeated near-tangent collisions, leaving it drifting horizontally
 * with near-zero vy. enforceMinSpeed() guards against this by re-injecting
 * energy when the magnitude drops below a threshold, with a small random
 * vertical component so it doesn't just re-horizontal-glide.
 */

const MIN_SPEED_FRACTION = 0.95; // 95% of base speed is the floor

/**
 * Re-normalize the ball's velocity so that its magnitude is at least
 * MIN_SPEED_FRACTION × BALL_BASE_SPEED, while preserving direction.
 * If the existing direction is degenerate (vx and vy both ~0), inject a
 * small upward + random horizontal component so the ball can escape.
 *
 * @param {{vx:number, vy:number}} ball
 * @returns {{vx:number, vy:number}}
 */
export function enforceMinSpeed(ball) {
  const minSpeed = WORLD.BALL_BASE_SPEED * MIN_SPEED_FRACTION;
  let { vx, vy } = ball;
  let mag = Math.hypot(vx, vy);

  if (mag >= minSpeed) return { vx, vy };

  // Below threshold — re-inject speed.
  if (mag < 0.01) {
    // Degenerate direction (or stuck). Pick a sane escape vector.
    const sign = Math.random() < 0.5 ? -1 : 1;
    vx = sign * WORLD.BALL_BASE_SPEED * 0.4;
    vy = WORLD.BALL_BASE_SPEED * 0.9;
  } else {
    // Direction is OK, just scale up to minSpeed.
    const scale = minSpeed / mag;
    vx *= scale;
    vy *= scale;
  }

  // Final safety: ensure ball is moving upward (game expects vy > 0
  // when ball is launched and moving away from paddle).
  if (Math.abs(vy) < WORLD.BALL_BASE_SPEED * 0.3) {
    vy = (vy < 0 ? -1 : 1) * WORLD.BALL_BASE_SPEED * 0.3;
  }

  return { vx, vy };
}

/**
 * Snap a ball back into the world if it somehow escapes bounds.
 * Used as a final safety net in the physics loop.
 */
export function clampBallToWorld(ball, worldWidth) {
  const halfW = worldWidth / 2;
  const halfH = WORLD.HEIGHT / 2;
  let { x, y, r } = ball;
  let clamped = false;
  if (y + r > halfH) {
    y = halfH - r;
    clamped = true;
  }
  if (y - r < -halfH * 2) {
    y = -halfH * 2;
    clamped = true;
  }
  if (x - r < -halfW) {
    x = -halfW + r;
    clamped = true;
  }
  if (x + r > halfW) {
    x = halfW - r;
    clamped = true;
  }
  return { ball: { ...ball, x, y }, clamped };
}
