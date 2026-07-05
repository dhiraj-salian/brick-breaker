import { WORLD } from './constants.js';

/**
 * Pure collision detection.
 *
 * Exports:
 *  - circleAabbHit(ball, aabb)  → { hit, nx, ny } or null
 *  - detectBrickCollisions(state) → events[]
 *  - detectPaddleCollision(ball, paddle) → { hit, spin } or null
 *  - detectWallBounce(ball, worldWidth, worldHeight) → { hit, nx, ny } or null
 *
 * Coordinate convention:
 *  - Ball: { x, y, vx, vy, r }
 *  - AABB: { x, y, w, h }  (center, size)
 */

export function circleAabbHit(ball, aabb) {
  const dx = ball.x - clamp(ball.x, aabb.x - aabb.w / 2, aabb.x + aabb.w / 2);
  const dy = ball.y - clamp(ball.y, aabb.y - aabb.h / 2, aabb.y + aabb.h / 2);
  const distSq = dx * dx + dy * dy;
  if (distSq > ball.r * ball.r) return null;

  // Determine normal: find axis with smaller penetration
  const overlapX = ball.r - Math.abs(dx);
  const overlapY = ball.r - Math.abs(dy);

  if (overlapX < overlapY) {
    return { nx: Math.sign(dx) || 1, ny: 0 };
  }
  return { nx: 0, ny: Math.sign(dy) || 1 };
}

export function detectBrickCollisions(state) {
  const events = [];
  for (const ball of state.balls) {
    if (ball.attached) continue;
    for (const brick of state.bricks) {
      if (brick.broken) continue;
      const hit = circleAabbHit(ball, brick);
      if (hit) {
        events.push({ type: 'BRICK_HIT', ball, brick, nx: hit.nx, ny: hit.ny });
      }
    }
  }
  return events;
}

export function detectPaddleCollision(ball, paddle) {
  if (ball.attached) return null;
  // Normalize paddle to the AABB shape expected by circleAabbHit
  // (paddle uses `width`/`height`; circleAabbHit expects `w`/`h`).
  // Without this, every check is a phantom hit (NaN propagation in the
  // math makes `distSq > r*r` false) and the ball gets re-bounced each frame.
  const paddleAabb = {
    x: paddle.x,
    y: paddle.y,
    w: paddle.width ?? paddle.w ?? WORLD.PADDLE_WIDTH,
    h: paddle.height ?? paddle.h ?? WORLD.PADDLE_HEIGHT,
  };
  const hit = circleAabbHit(ball, paddleAabb);
  if (!hit) return null;
  // Contact offset in [-1, 1] based on horizontal position
  const halfW = paddleAabb.w / 2;
  const offset = halfW > 0 ? clamp((ball.x - paddle.x) / halfW, -1, 1) : 0;
  return { ...hit, spin: offset };
}

export function detectWallBounce(ball, worldWidth, worldHeight = WORLD.HEIGHT) {
  const halfW = worldWidth / 2;
  const halfH = worldHeight / 2;
  // Top wall
  if (ball.y + ball.r > halfH) return { nx: 0, ny: -1 };
  // Left wall
  if (ball.x - ball.r < -halfW) return { nx: 1, ny: 0 };
  // Right wall
  if (ball.x + ball.r > halfW) return { nx: -1, ny: 0 };
  return null;
}

/**
 * Multi-axis bounce: ball hits the nearest axis from circleAabbHit,
 * then we zero out that velocity component. Returns new ball.
 */
export function bounceBall(ball, nx, ny, speed = null) {
  let { vx, vy } = ball;
  if (nx !== 0) vx = Math.abs(vx) * nx;
  if (ny !== 0) vy = Math.abs(vy) * ny;
  // Re-normalize to maintain speed (in case of small numerical drift)
  if (speed != null) {
    const cur = Math.hypot(vx, vy);
    if (cur > 0) {
      vx = (vx / cur) * speed;
      vy = (vy / cur) * speed;
    }
  }
  return { ...ball, vx, vy };
}

export function safeNormalize(vx, vy, fallbackSpeed = 1) {
  const cur = Math.hypot(vx, vy);
  if (cur > 0.001) return { vx: (vx / cur) * fallbackSpeed, vy: (vy / cur) * fallbackSpeed };
  return { vx: 0, vy: fallbackSpeed };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
