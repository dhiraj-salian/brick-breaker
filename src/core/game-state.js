import { STATUS, WORLD } from './constants.js';

/**
 * GameState — pure factory + transitions.
 * No class; state is a plain object passed through pure functions.
 */

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
    worldWidth: 14, // updated by scene init
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
    return { ...state, lives: 0, status: STATUS.LOST, balls: [] };
  }
  return { ...state, lives };
}

export function winLevel(state) {
  // Caller decides whether to advance to next level or mark WON.
  return state;
}

export function winGame(state) {
  return { ...state, status: STATUS.WON };
}
