import { WORLD } from './constants.js';
import { enforceMinSpeed, clampBallToWorld } from './ball-utils.js';

/**
 * Physics stepper — fixed-timestep ball/paddle motion.
 *
 * stepPhysics(state, dt) returns a new state with:
 *  - paddle lerped toward paddle.targetX (clamped to world bounds)
 *  - each ball: pos += vel * dt; wall bounces applied; min-speed enforced
 *  - shake and flash decay
 *  - ball despawn if it falls below LOSE_Y
 *
 * Game-state-mutating events (collisions, life loss) are NOT handled here;
 * the caller runs detectCollisions() then applies events separately.
 */

const PADDLE_LERP_FACTOR = 1 - Math.exp(-WORLD.PADDLE_LERP * 0.016); // dt-independent

export function stepPhysics(state, dt) {
  // Paddle: lerp toward targetX
  const targetX = state.paddle.targetX ?? state.paddle.x;
  const paddleX = state.paddle.x + (targetX - state.paddle.x) * PADDLE_LERP_FACTOR;
  const halfW = state.worldWidth / 2;
  const halfH = WORLD.HEIGHT / 2;
  const clampedPaddleX = clamp(
    paddleX,
    -halfW + state.paddle.width / 2,
    halfW - state.paddle.width / 2
  );

  const paddle = { ...state.paddle, x: clampedPaddleX, targetX };

  // Balls: integrate + wall bounce + min-speed enforcement.
  let balls = state.balls.map((ball) => {
    if (ball.attached) return ball;

    let { x, y, vx, vy, r } = ball;
    x += vx * dt;
    y += vy * dt;

    // Top wall
    if (y + r > halfH) {
      y = halfH - r;
      vy = -Math.abs(vy);
    }
    // Left/right walls
    if (x - r < -halfW) {
      x = -halfW + r;
      vx = Math.abs(vx);
    } else if (x + r > halfW) {
      x = halfW - r;
      vx = -Math.abs(vx);
    }

    // Safety net: if ball escaped world bounds, snap back.
    const { ball: clamped, clamped: wasClamped } = clampBallToWorld(
      { ...ball, x, y, vx, vy },
      state.worldWidth
    );
    x = clamped.x;
    y = clamped.y;
    vx = clamped.vx;
    vy = clamped.vy;

    // Min-speed enforcement — prevents "stuck sliding" after many bounces.
    if (wasClamped || Math.hypot(vx, vy) < WORLD.BALL_BASE_SPEED * 0.95) {
      const fixed = enforceMinSpeed({ vx, vy });
      vx = fixed.vx;
      vy = fixed.vy;
    }

    return { ...ball, x, y, vx, vy };
  });

  // Despawn balls that fell off bottom
  const alive = balls.filter((b) => b.y > WORLD.LOSE_Y);
  const lost = alive.length < balls.length;
  balls = alive;

  // Shake and flash decay
  const shake = { intensity: state.shake.intensity * Math.pow(WORLD.SHAKE_DECAY, dt * 60) };
  const flash = Math.max(0, state.flash - dt * WORLD.FLASH_DECAY);

  return {
    ...state,
    paddle,
    balls,
    shake,
    flash,
    _lostBall: lost,
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
