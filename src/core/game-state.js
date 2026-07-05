import { STATUS, WORLD } from './constants.js';

/**
 * GameState — pure factory + transitions.
 * No class; state is a plain object passed through pure functions.
 */

// Horizontal margin around the brick grid, in world units.
// Used both by scene.js (frustum sizing) and game-state.js (physics
// world width) so the ball can always reach the outermost columns.
export const HORIZONTAL_MARGIN = 1.0;

// Required world width: brick layout + 2 * margin. Ball physics must use
// this (or anything larger) so all BRICK_COLS are reachable.
export const REQUIRED_WORLD_WIDTH =
  WORLD.BRICK_COLS * (WORLD.BRICK_WIDTH + WORLD.BRICK_GAP) + 2 * HORIZONTAL_MARGIN;

export function createInitialState(level = 1) {
  return {
    status: STATUS.MENU,
    level,
    score: 0,
    lives: WORLD.LIVES,
    combo: 1,
    comboTimer: 0,
    paddle: {
      x: 0,
      y: WORLD.PADDLE_Y,
      width: WORLD.PADDLE_WIDTH,
      targetWidth: WORLD.PADDLE_WIDTH,
    },
    balls: [],
    bricks: [],
    powerUps: [],
    activeEffects: [],
    shake: { intensity: 0 },
    flash: 0,
    cameraY: 0,
    // Sized so all bricks fit horizontally with the standard margin.
    // Updated by main.js's resize loop if the viewport demands a wider
    // frustum (e.g. mobile portrait), but never narrower than this.
    worldWidth: REQUIRED_WORLD_WIDTH,
  };
}

export function startGame(state) {
  if (state.status !== STATUS.MENU && state.status !== STATUS.LOST && state.status !== STATUS.WON) {
    return state;
  }
  return {
    ...state,
    status: STATUS.PLAYING,
    score: 0,
    lives: WORLD.LIVES,
    combo: 1,
    comboTimer: 0,
    paddle: { ...state.paddle, width: WORLD.PADDLE_WIDTH, targetWidth: WORLD.PADDLE_WIDTH },
    balls: [],
    powerUps: [],
    activeEffects: [],
  };
}

export function pause(state) {
  if (state.status !== STATUS.PLAYING) return state;
  return { ...state, status: STATUS.PAUSED };
}

export function resume(state) {
  if (state.status !== STATUS.PAUSED) return state;
  return { ...state, status: STATUS.PLAYING };
}

export function loseLife(state) {
  if (state.status !== STATUS.PLAYING) return state;
  const lives = state.lives - 1;
  if (lives <= 0) {
    // LOST is a terminal state — clear remaining balls so the scene visibly
    // stops moving (otherwise the ball keeps flying/falling forever, looking
    // like the game is "stuck on finishing").
    return { ...state, lives: 0, status: STATUS.LOST, balls: [], _lostBall: false };
  }
  return { ...state, lives };
}

export function winLevel(state) {
  // Caller decides whether to advance to next level or mark WON.
  return state;
}

export function winGame(state) {
  // WON is also terminal — clear balls and reset combo so the win screen
  // is a clean freeze, not a ball still flying across an empty grid.
  return { ...state, status: STATUS.WON, balls: [], combo: 1, comboTimer: 0 };
}
