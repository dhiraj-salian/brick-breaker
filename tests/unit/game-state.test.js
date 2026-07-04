import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  startGame,
  pause,
  resume,
  loseLife,
  winGame,
} from '../../src/core/game-state.js';
import { STATUS } from '../../src/core/constants.js';

describe('game-state', () => {
  it('createInitialState returns MENU status with default lives', () => {
    const s = createInitialState();
    expect(s.status).toBe(STATUS.MENU);
    expect(s.lives).toBe(3);
    expect(s.score).toBe(0);
    expect(s.balls).toEqual([]);
    expect(s.bricks).toEqual([]);
  });

  it('startGame transitions MENU → PLAYING and resets score/lives', () => {
    const s = createInitialState();
    const started = startGame(s);
    expect(started.status).toBe(STATUS.PLAYING);
    expect(started.score).toBe(0);
    expect(started.lives).toBe(3);
  });

  it('startGame is a no-op when already PLAYING', () => {
    const s = { ...createInitialState(), status: STATUS.PLAYING, score: 999 };
    const out = startGame(s);
    expect(out).toBe(s);
  });

  it('pause transitions PLAYING → PAUSED', () => {
    const s = { ...createInitialState(), status: STATUS.PLAYING };
    expect(pause(s).status).toBe(STATUS.PAUSED);
  });

  it('resume transitions PAUSED → PLAYING', () => {
    const s = { ...createInitialState(), status: STATUS.PAUSED };
    expect(resume(s).status).toBe(STATUS.PLAYING);
  });

  it('loseLife decrements lives', () => {
    const s = { ...createInitialState(), status: STATUS.PLAYING, lives: 3 };
    expect(loseLife(s).lives).toBe(2);
  });

  it('loseLife at 0 lives → LOST', () => {
    const s = { ...createInitialState(), status: STATUS.PLAYING, lives: 1 };
    const out = loseLife(s);
    expect(out.status).toBe(STATUS.LOST);
    expect(out.lives).toBe(0);
  });

  it('winGame transitions to WON', () => {
    const s = { ...createInitialState(), status: STATUS.PLAYING };
    expect(winGame(s).status).toBe(STATUS.WON);
  });
});
