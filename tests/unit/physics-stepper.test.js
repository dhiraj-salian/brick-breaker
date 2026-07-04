import { describe, it, expect } from 'vitest';
import { stepPhysics } from '../../src/core/physics-stepper.js';
import { WORLD } from '../../src/core/constants.js';

const baseState = (overrides = {}) => ({
  status: 'playing',
  paddle: { x: 0, y: WORLD.PADDLE_Y, width: WORLD.PADDLE_WIDTH, targetX: 0 },
  balls: [],
  bricks: [],
  powerUps: [],
  activeEffects: [],
  shake: { intensity: 0 },
  flash: 0,
  worldWidth: 14,
  ...overrides,
});

describe('physics-stepper', () => {
  it('ball moves at velocity * dt', () => {
    const s = baseState({
      balls: [{ x: 0, y: 0, vx: 10, vy: 0, r: 0.3 }],
    });
    const out = stepPhysics(s, 0.1);
    expect(out.balls[0].x).toBeCloseTo(1.0, 5);
  });

  it('ball bounces off top wall', () => {
    const s = baseState({
      balls: [{ x: 0, y: 9.5, vx: 0, vy: 20, r: 0.3 }],
    });
    const out = stepPhysics(s, 0.1);
    // y should be clamped to halfH - r = 10 - 0.3 = 9.7
    expect(out.balls[0].y).toBeLessThanOrEqual(10 - 0.3 + 0.001);
    expect(out.balls[0].vy).toBeLessThan(0);
  });

  it('ball bounces off right wall', () => {
    const s = baseState({
      balls: [{ x: 6.5, y: 0, vx: 20, vy: 0, r: 0.3 }],
    });
    const out = stepPhysics(s, 0.1);
    expect(out.balls[0].x).toBeLessThanOrEqual(7 - 0.3 + 0.001);
    expect(out.balls[0].vx).toBeLessThan(0);
  });

  it('ball despawns when falling below LOSE_Y', () => {
    const s = baseState({
      balls: [{ x: 0, y: -11, vx: 0, vy: -20, r: 0.3 }],
    });
    const out = stepPhysics(s, 0.1);
    expect(out.balls).toHaveLength(0);
    expect(out._lostBall).toBe(true);
  });

  it('paddle lerps toward targetX', () => {
    const s = baseState();
    s.paddle.x = 0;
    s.paddle.targetX = 5;
    const out = stepPhysics(s, 0.1);
    expect(out.paddle.x).toBeGreaterThan(0);
    expect(out.paddle.x).toBeLessThan(5);
  });

  it('paddle clamps to world bounds', () => {
    const s = baseState();
    s.paddle.x = 0;
    s.paddle.targetX = 100; // way out of bounds
    const out = stepPhysics(s, 1.0); // big dt → snap
    const halfW = s.worldWidth / 2;
    expect(out.paddle.x).toBeLessThanOrEqual(halfW - s.paddle.width / 2 + 0.01);
  });

  it('shake intensity decays', () => {
    const s = baseState({ shake: { intensity: 1.0 } });
    const out = stepPhysics(s, 0.1);
    expect(out.shake.intensity).toBeLessThan(1.0);
  });

  it('flash decays', () => {
    const s = baseState({ flash: 1.0 });
    const out = stepPhysics(s, 0.1);
    expect(out.flash).toBeLessThan(1.0);
  });
});
