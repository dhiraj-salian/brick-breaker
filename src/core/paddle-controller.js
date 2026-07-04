import { WORLD } from './constants.js';

/**
 * Paddle controller — pure functions.
 *
 * updatePaddleTarget(state, targetX) → state with paddle.targetX set
 * attachBallToPaddle(state) → state with ball glued above paddle, not yet moving
 * launchBall(state) → state with ball velocity (default direction: up + small random x)
 */

export function updatePaddleTarget(state, targetX) {
  return {
    ...state,
    paddle: { ...state.paddle, targetX },
  };
}

export function attachBallToPaddle(state) {
  if (state.balls.length > 0) return state;
  const ball = {
    x: state.paddle.x,
    y: state.paddle.y + WORLD.PADDLE_HEIGHT / 2 + WORLD.BALL_RADIUS + 0.2,
    vx: 0,
    vy: 0,
    r: WORLD.BALL_RADIUS,
    attached: true,
  };
  return { ...state, balls: [ball] };
}

export function launchBall(state, angleDeg = null) {
  if (state.balls.length === 0) return state;
  const speed = WORLD.BALL_BASE_SPEED * (1 + (state.level - 1) * 0.05);
  const angle = (angleDeg ?? 75 + (Math.random() * 30 - 15)) * (Math.PI / 180); // 60–90° upward
  const vx = Math.cos(angle) * speed;
  const vy = Math.abs(Math.sin(angle)) * speed; // upward
  return {
    ...state,
    balls: state.balls.map((b) => ({ ...b, vx, vy, attached: false })),
  };
}
