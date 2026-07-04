import { describe, it, expect } from 'vitest';
import { splitBall, reattachLostBalls } from '../../src/core/ball-controller.js';

describe('ball-controller', () => {
  it('splitBall returns original + N new balls', () => {
    const b = { x: 0, y: 0, vx: 1, vy: 10, r: 0.3 };
    const out = splitBall(b, 2);
    expect(out).toHaveLength(3); // original + 2
  });

  it('splitBall new balls have upward velocity', () => {
    const b = { x: 0, y: 0, vx: 0, vy: 10, r: 0.3 };
    const out = splitBall(b, 2);
    out.slice(1).forEach((ball) => {
      expect(ball.vy).toBeGreaterThan(0);
    });
  });

  it('splitBall new balls preserve speed magnitude', () => {
    const b = { x: 0, y: 0, vx: 0, vy: 12, r: 0.3 };
    const out = splitBall(b, 2);
    out.forEach((ball) => {
      const speed = Math.hypot(ball.vx, ball.vy);
      expect(speed).toBeCloseTo(12, 5);
    });
  });

  it('reattachLostBalls attaches one ball when none exist', () => {
    const s = { paddle: { x: 1, y: -8 }, balls: [] };
    const out = reattachLostBalls(s);
    expect(out.balls).toHaveLength(1);
    expect(out.balls[0].attached).toBe(true);
    expect(out.balls[0].x).toBe(1);
  });

  it('reattachLostBalls is no-op when balls exist', () => {
    const s = { paddle: { x: 0, y: -8 }, balls: [{ x: 5, y: 5 }] };
    const out = reattachLostBalls(s);
    expect(out).toBe(s);
  });
});
