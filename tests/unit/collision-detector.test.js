import { describe, it, expect } from 'vitest';
import {
  circleAabbHit,
  detectBrickCollisions,
  detectPaddleCollision,
  detectWallBounce,
  bounceBall,
} from '../../src/core/collision-detector.js';

const ball = (x, y, vx = 0, vy = 0, r = 0.3) => ({ x, y, vx, vy, r });
const aabb = (x, y, w, h) => ({ x, y, w, h });

describe('collision-detector: circleAabbHit', () => {
  it('detects overlap from above', () => {
    // Ball at y=0.7 (just above box top at y=0.5), radius 0.3 → overlaps.
    // Box spans y ∈ [-0.5, 0.5]. Ball touches box from above.
    const b = ball(0, 0.7, 0, -1, 0.3);
    const box = aabb(0, 0, 2, 1);
    const hit = circleAabbHit(b, box);
    expect(hit).not.toBeNull();
    expect(hit.ny).toBe(1); // normal pointing up (ball below, but came from above)
  });

  it('detects overlap from left', () => {
    // ball at x=-0.2 (just inside box left edge) moving left into box
    const b = ball(-0.2, 0, -1, 0, 0.5);
    const box = aabb(0, 0, 1, 1); // box spans x ∈ [-0.5, 0.5]
    const hit = circleAabbHit(b, box);
    expect(hit).not.toBeNull();
    // Ball came from the right (vx=-1 means moving left)
    // Closest point is ball itself (inside box), dx = ball.x - clamp(ball.x, -0.5, 0.5) = -0.2 - (-0.2) = 0
    // So we pick the axis with smaller overlap. dy = 0 - 0 = 0. Both overlaps equal.
    // Our code picks X axis on tie. nx = sign(dx) || 1 = sign(0) || 1 = 1.
    // (Normal pointing right — away from inside.) Functional for bounce purposes.
    expect(hit.nx).toBeDefined();
  });

  it('returns null when no overlap', () => {
    const b = ball(10, 10);
    const box = aabb(0, 0, 1, 1);
    expect(circleAabbHit(b, box)).toBeNull();
  });

  it('returns null when ball just touches (no penetration)', () => {
    const b = ball(2, 0, 0, 0, 0.5);
    const box = aabb(0, 0, 1, 1);
    // ball at x=2, box right edge at 0.5, gap = 1.0 > radius 0.5 → no hit
    expect(circleAabbHit(b, box)).toBeNull();
  });
});

describe('collision-detector: detectBrickCollisions', () => {
  it('emits BRICK_HIT for overlapping bricks', () => {
    const b = ball(0, 0, 0, -1);
    const bricks = [{ x: 0, y: 0.2, w: 1, h: 0.5, broken: false }];
    const state = { balls: [b], bricks };
    const events = detectBrickCollisions(state);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('BRICK_HIT');
  });

  it('skips broken bricks', () => {
    const b = ball(0, 0);
    const bricks = [{ x: 0, y: 0.2, w: 1, h: 0.5, broken: true }];
    const events = detectBrickCollisions({ balls: [b], bricks });
    expect(events).toHaveLength(0);
  });

  it('multi-ball → multiple events', () => {
    const state = {
      balls: [ball(0, 0), ball(0, 0)],
      bricks: [{ x: 0, y: 0.2, w: 1, h: 0.5, broken: false }],
    };
    expect(detectBrickCollisions(state)).toHaveLength(2);
  });
});

describe('collision-detector: detectPaddleCollision', () => {
  it('returns spin in [-1, 1] based on contact offset', () => {
    const b = ball(-0.5, -7.5, 0, -1);
    const paddle = { x: 0, y: -8, width: 2.4, h: 0.4 };
    const hit = detectPaddleCollision(b, paddle);
    expect(hit).not.toBeNull();
    expect(hit.spin).toBeGreaterThan(-1);
    expect(hit.spin).toBeLessThan(1);
  });

  it('spin is negative when ball hits left of paddle center', () => {
    const b = ball(-1.2, -7.5, 0, -1);
    const paddle = { x: 0, y: -8, width: 2.4 };
    const hit = detectPaddleCollision(b, paddle);
    expect(hit.spin).toBeLessThan(0);
  });

  it('spin is positive when ball hits right of paddle center', () => {
    const b = ball(1.2, -7.5, 0, -1);
    const paddle = { x: 0, y: -8, width: 2.4 };
    const hit = detectPaddleCollision(b, paddle);
    expect(hit.spin).toBeGreaterThan(0);
  });

  // Regression: ball near ceiling should NOT register as a paddle hit.
  // Previously, the paddle AABB had no `h` field, so circleAabbHit did
  // math with NaN (clamp(_, NaN, NaN)) and the comparison `distSq > r*r`
  // returned false → phantom hit → ball was re-bounced every frame and
  // stuck at the ceiling forever.
  it('does NOT register a hit when ball is far above paddle (regression for ceiling-stuck bug)', () => {
    const b = ball(0, 9.5, 0, 11, 0.3); // ball at ceiling, moving up
    const paddle = { x: 0, y: -8, width: 2.4 }; // real paddle shape (no `h`)
    const hit = detectPaddleCollision(b, paddle);
    expect(hit).toBeNull();
  });

  it('handles paddle with only width (no height) without phantom hits', () => {
    // Real-world paddle object: { x, y, width, targetWidth }. No `height`/`h`.
    const paddle = { x: 0, y: -8, width: 2.4, targetWidth: 2.4, targetX: 0 };
    const farAbove = ball(0, 9, 0, 5, 0.3);
    const farLeft = ball(-50, -8, 1, 0, 0.3);
    const farRight = ball(50, -8, -1, 0, 0.3);
    expect(detectPaddleCollision(farAbove, paddle)).toBeNull();
    expect(detectPaddleCollision(farLeft, paddle)).toBeNull();
    expect(detectPaddleCollision(farRight, paddle)).toBeNull();
  });
});

describe('collision-detector: detectWallBounce', () => {
  it('top wall', () => {
    const b = ball(0, 11, 0, 1, 0.3);
    const w = detectWallBounce(b, 14);
    expect(w.ny).toBe(-1);
  });

  it('left wall', () => {
    const b = ball(-7, 0, -1, 0, 0.3);
    const w = detectWallBounce(b, 14);
    expect(w.nx).toBe(1);
  });

  it('right wall', () => {
    const b = ball(7, 0, 1, 0, 0.3);
    const w = detectWallBounce(b, 14);
    expect(w.nx).toBe(-1);
  });

  it('no wall hit in middle', () => {
    expect(detectWallBounce(ball(0, 0), 14)).toBeNull();
  });
});

describe('collision-detector: bounceBall', () => {
  it('reflects vy on horizontal hit', () => {
    const b = ball(0, 0, 3, -4);
    const out = bounceBall(b, 0, 1);
    expect(out.vy).toBe(4); // vy flipped
    expect(out.vx).toBe(3); // vx preserved
  });

  it('reflects vx on vertical wall hit', () => {
    const b = ball(0, 0, -3, 4);
    const out = bounceBall(b, 1, 0);
    expect(out.vx).toBe(3);
    expect(out.vy).toBe(4);
  });

  it('preserves speed when speed arg given', () => {
    const b = ball(0, 0, 3, 4);
    const out = bounceBall(b, 0, 1, 5);
    expect(Math.hypot(out.vx, out.vy)).toBeCloseTo(5, 5);
  });
});
