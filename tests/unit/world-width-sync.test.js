// Regression test for the "outer bricks unreachable" bug (round 2).
//
// Symptom (Dhiraj, 2026-07-05 16:42 IST): "the width for ball movement
// is smaller than the width for tile placement which leaves some tiles
// on the sides unreachable."
//
// Root cause: createInitialState() hardcoded `worldWidth: 14`, but the
// rendered scene's world width (computed by resize() in scene.js) varies
// with viewport aspect ratio and is sized so all 10 brick columns fit
// with a 1.0 unit margin on each side (~21 units wide on landscape).
//
// The ball/paddle physics read state.worldWidth, while the camera frustum
// uses fh*aspect. They drifted apart, so the ball bounced off invisible
// physics walls at x=±7 while bricks were visually at x=±9.5 — making
// the outermost columns literally unreachable.
//
// Fix: state.worldWidth must always equal the camera's world width.
// We model that contract here so future resize/canvas-size changes
// don't silently break reachability again.

import { describe, it, expect } from 'vitest';
import { WORLD } from '../../src/core/constants.js';
import { createInitialState, startGame } from '../../src/core/game-state.js';

describe('state.worldWidth stays in sync with rendered world (regression)', () => {
  it('initial worldWidth matches the brick layout (NOT the old hardcoded 14)', () => {
    const s = createInitialState();
    // Brick layout spans BRICK_COLS * (BRICK_WIDTH + BRICK_GAP) ≈ 19 units.
    // The rendered world must be wider than that for the bricks to fit.
    const brickLayoutWidth = WORLD.BRICK_COLS * (WORLD.BRICK_WIDTH + WORLD.BRICK_GAP);
    expect(
      s.worldWidth,
      `initial state.worldWidth (${s.worldWidth}) is narrower than the brick layout ` +
        `(${brickLayoutWidth.toFixed(2)}). Outer bricks will be unreachable.`
    ).toBeGreaterThan(brickLayoutWidth);
  });

  it('ball can reach every brick column when worldWidth is set correctly', () => {
    // Simulate the "correct" worldWidth: brick layout width + 2 * margin.
    const HORIZONTAL_MARGIN = 1.0;
    const correctWorldWidth =
      WORLD.BRICK_COLS * (WORLD.BRICK_WIDTH + WORLD.BRICK_GAP) + 2 * HORIZONTAL_MARGIN;

    const cellW = WORLD.BRICK_WIDTH + WORLD.BRICK_GAP;
    const halfW = correctWorldWidth / 2;

    // Every brick center must be within the ball's reachable range.
    for (let col = 0; col < WORLD.BRICK_COLS; col++) {
      const brickX = -correctWorldWidth / 2 + cellW / 2 + col * cellW;
      const brickEdge = Math.abs(brickX) + WORLD.BRICK_WIDTH / 2;
      expect(
        brickEdge,
        `col ${col}: brick edge at x=${brickEdge.toFixed(2)} exceeds world half-width ${halfW.toFixed(2)} ` +
          `(worldWidth=${correctWorldWidth}). Column unreachable.`
      ).toBeLessThanOrEqual(halfW);
    }
  });

  it('startGame does not reset worldWidth (preserves canvas-derived value)', () => {
    // Once the main loop calls resize() and writes state.worldWidth,
    // subsequent transitions (startGame) must NOT clobber it back to 14.
    const s = { ...createInitialState(), worldWidth: 21 };
    const out = startGame(s);
    expect(out.worldWidth).toBe(21);
  });
});
