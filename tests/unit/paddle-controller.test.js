import { describe, it, expect } from 'vitest';
import {
  updatePaddleTarget,
  attachBallToPaddle,
  launchBall,
} from '../../src/core/paddle-controller.js';
import { WORLD } from '../../src/core/constants.js';

describe('paddle-controller', () => {
  it('updatePaddleTarget sets paddle.targetX', () => {
    const s = { paddle: { x: 0, width: 2 } };
    const out = updatePaddleTarget(s, 5);
    expect(out.paddle.targetX).toBe(5);
  });

  it('attachBallToPaddle adds one ball above paddle center', () => {
    const s = { paddle: { x: 1, y: WORLD.PADDLE_Y }, balls: [] };
    const out = attachBallToPaddle(s);
    expect(out.balls).toHaveLength(1);
    expect(out.balls[0].attached).toBe(true);
    expect(out.balls[0].x).toBe(1);
    expect(out.balls[0].vy).toBe(0);
  });

  it('attachBallToPaddle is no-op when ball already present', () => {
    const s = { paddle: { x: 0, y: WORLD.PADDLE_Y }, balls: [{ x: 0, y: 0 }] };
    const out = attachBallToPaddle(s);
    expect(out.balls).toHaveLength(1);
  });

  it('launchBall gives ball upward velocity', () => {
    const s = {
      paddle: { x: 0, y: WORLD.PADDLE_Y },
      balls: [{ x: 0, y: 0, vx: 0, vy: 0, attached: true }],
      level: 1,
    };
    const out = launchBall(s);
    expect(out.balls[0].vy).toBeGreaterThan(0); // upward (positive vy)
    expect(out.balls[0].attached).toBe(false);
  });

  it('launchBall uses custom angle when provided', () => {
    const s = {
      paddle: { x: 0, y: WORLD.PADDLE_Y },
      balls: [{ x: 0, y: 0, vx: 0, vy: 0, attached: true }],
      level: 1,
    };
    const out = launchBall(s, 90); // straight up
    expect(out.balls[0].vx).toBeCloseTo(0, 1);
    expect(out.balls[0].vy).toBeGreaterThan(0);
  });
});
