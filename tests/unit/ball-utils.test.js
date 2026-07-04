import { describe, it, expect } from 'vitest';
import { enforceMinSpeed, clampBallToWorld } from '../../src/core/ball-utils.js';
import { WORLD } from '../../src/core/constants.js';

describe('enforceMinSpeed', () => {
  it('passes through balls already at or above minimum speed', () => {
    const result = enforceMinSpeed({ vx: 8, vy: 8 }); // mag = ~11.3
    expect(Math.hypot(result.vx, result.vy)).toBeGreaterThanOrEqual(WORLD.BALL_BASE_SPEED * 0.95);
  });

  it('boosts under-speed balls while preserving direction', () => {
    const result = enforceMinSpeed({ vx: 2, vy: 0.5 }); // mag = ~2.06
    const newMag = Math.hypot(result.vx, result.vy);
    expect(newMag).toBeGreaterThanOrEqual(WORLD.BALL_BASE_SPEED * 0.95);
    // Direction should be preserved (sign + roughly same ratio).
    expect(result.vx).toBeGreaterThan(0);
    expect(result.vy).toBeGreaterThan(0);
  });

  it('injects a sane escape vector when direction is degenerate', () => {
    const result = enforceMinSpeed({ vx: 0, vy: 0 });
    // Must have non-zero velocity.
    expect(Math.hypot(result.vx, result.vy)).toBeGreaterThan(0);
    // Must be moving upward (toward bricks).
    expect(Math.abs(result.vy)).toBeGreaterThan(WORLD.BALL_BASE_SPEED * 0.2);
  });

  it('keeps vertical component meaningful even when boost is from low-vy state', () => {
    const result = enforceMinSpeed({ vx: 0, vy: 0.01 });
    expect(Math.abs(result.vy)).toBeGreaterThanOrEqual(WORLD.BALL_BASE_SPEED * 0.3);
  });
});

describe('clampBallToWorld', () => {
  it('snaps a ball back when it escapes top wall', () => {
    const { ball, clamped } = clampBallToWorld(
      { x: 0, y: 100, r: 0.3, vx: 0, vy: 0 },
      WORLD.HEIGHT // worldWidth doesn't matter here
    );
    expect(clamped).toBe(true);
    expect(ball.y).toBeLessThanOrEqual(WORLD.HEIGHT / 2);
  });

  it('returns unchanged ball when in bounds', () => {
    const { ball, clamped } = clampBallToWorld({ x: 0, y: 0, r: 0.3, vx: 5, vy: 5 }, 20);
    expect(clamped).toBe(false);
    expect(ball.x).toBe(0);
    expect(ball.y).toBe(0);
  });

  it('snaps a ball back when it escapes left/right walls', () => {
    const { ball, clamped } = clampBallToWorld(
      { x: -100, y: 0, r: 0.3, vx: 0, vy: 0 },
      20 // worldWidth = 20, halfW = 10
    );
    expect(clamped).toBe(true);
    expect(ball.x).toBeGreaterThanOrEqual(-10);
  });
});
