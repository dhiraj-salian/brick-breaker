// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { computePaddleTargetX } from '../../src/ui/input.js';
import { WORLD } from '../../src/core/constants.js';

describe('computePaddleTargetX (pure function)', () => {
  const worldWidth = 14;
  const dt = 1 / 60;
  const paddleSpeed = WORLD.PADDLE_SPEED; // 16

  it('ArrowRight held advances targetX by paddleSpeed * dt per frame', () => {
    const keys = new Set(['ArrowRight']);
    const r1 = computePaddleTargetX({
      keysHeld: keys,
      pointerRatio: 0.5,
      worldWidth,
      dt,
      paddleSpeed,
      currentTargetX: 0,
    });
    expect(r1.delta).toBeCloseTo(paddleSpeed * dt, 10);
    expect(r1.targetX).toBeCloseTo(paddleSpeed * dt, 10);

    // Second frame: integrate from new target
    const r2 = computePaddleTargetX({
      keysHeld: keys,
      pointerRatio: 0.5,
      worldWidth,
      dt,
      paddleSpeed,
      currentTargetX: r1.targetX,
    });
    expect(r2.targetX).toBeCloseTo(paddleSpeed * dt * 2, 10);
    expect(r2.delta).toBeCloseTo(paddleSpeed * dt, 10);

    // NOT worldWidth/2
    expect(r1.targetX).not.toBe(worldWidth / 2);
    expect(r2.targetX).not.toBe(worldWidth / 2);
  });

  it('ArrowLeft held decreases targetX by paddleSpeed * dt per frame', () => {
    const keys = new Set(['ArrowLeft']);
    const r = computePaddleTargetX({
      keysHeld: keys,
      pointerRatio: 0.5,
      worldWidth,
      dt,
      paddleSpeed,
      currentTargetX: 0,
    });
    expect(r.delta).toBeCloseTo(-paddleSpeed * dt, 10);
    expect(r.targetX).toBeCloseTo(-paddleSpeed * dt, 10);
  });

  it('KeyA and KeyD work as aliases for ArrowLeft and ArrowRight', () => {
    const keysA = new Set(['KeyA']);
    const rA = computePaddleTargetX({
      keysHeld: keysA,
      pointerRatio: null,
      worldWidth,
      dt,
      paddleSpeed,
      currentTargetX: 0,
    });
    expect(rA.delta).toBeLessThan(0);

    const keysD = new Set(['KeyD']);
    const rD = computePaddleTargetX({
      keysHeld: keysD,
      pointerRatio: null,
      worldWidth,
      dt,
      paddleSpeed,
      currentTargetX: 0,
    });
    expect(rD.delta).toBeGreaterThan(0);
  });

  it('keyup ArrowRight stops advancement (no keys → pointer takes over)', () => {
    // Frame 1: ArrowRight held
    const keysRight = new Set(['ArrowRight']);
    const r1 = computePaddleTargetX({
      keysHeld: keysRight,
      pointerRatio: 0.5,
      worldWidth,
      dt,
      paddleSpeed,
      currentTargetX: 0,
    });
    expect(r1.delta).toBeGreaterThan(0);

    // Frame 2: key released, no keys held, pointer at 0.5
    const noKeys = new Set();
    const r2 = computePaddleTargetX({
      keysHeld: noKeys,
      pointerRatio: 0.5,
      worldWidth,
      dt,
      paddleSpeed,
      currentTargetX: r1.targetX,
    });
    // Should snap to pointer position, NOT continue advancing
    expect(r2.delta).toBe(0);
    expect(r2.targetX).toBeCloseTo(-worldWidth / 2 + 0.5 * worldWidth, 10);
  });

  it('ArrowLeft + ArrowRight held → no movement (cancel out)', () => {
    const keys = new Set(['ArrowLeft', 'ArrowRight']);
    const r = computePaddleTargetX({
      keysHeld: keys,
      pointerRatio: 0.5,
      worldWidth,
      dt,
      paddleSpeed,
      currentTargetX: 3,
    });
    expect(r.delta).toBe(0);
    expect(r.targetX).toBe(3); // stays at current target, pointer doesn't take over
  });

  it('No keys and no pointer → targetX is null (no input)', () => {
    const r = computePaddleTargetX({
      keysHeld: new Set(),
      pointerRatio: null,
      worldWidth,
      dt,
      paddleSpeed,
      currentTargetX: 0,
    });
    expect(r.targetX).toBeNull();
    expect(r.delta).toBe(0);
  });

  it('Keyboard wins over pointer when keys are held', () => {
    const keys = new Set(['ArrowRight']);
    const r = computePaddleTargetX({
      keysHeld: keys,
      pointerRatio: 0.0, // pointer at far left
      worldWidth,
      dt,
      paddleSpeed,
      currentTargetX: 0,
    });
    // Should move right (keyboard), not snap to left (pointer)
    expect(r.delta).toBeGreaterThan(0);
    expect(r.targetX).toBeGreaterThan(0);
  });

  it('Multiple frames of ArrowRight produce smooth linear movement', () => {
    const keys = new Set(['ArrowRight']);
    let target = 0;
    const positions = [];
    for (let i = 0; i < 10; i++) {
      const r = computePaddleTargetX({
        keysHeld: keys,
        pointerRatio: null,
        worldWidth,
        dt,
        paddleSpeed,
        currentTargetX: target,
      });
      target = r.targetX;
      positions.push(target);
    }
    // Each step should advance by exactly paddleSpeed * dt
    const expectedStep = paddleSpeed * dt;
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i] - positions[i - 1]).toBeCloseTo(expectedStep, 10);
    }
    // Final position should be 10 * expectedStep
    expect(positions[9]).toBeCloseTo(10 * expectedStep, 10);
  });
});
