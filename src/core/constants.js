/**
 * Constants — pure data, single source of truth for game tuning.
 */

export const STATUS = Object.freeze({
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  WON: 'won',
  LOST: 'lost',
});

export const BRICK_TYPE = Object.freeze({
  NORMAL: 'normal',
  ARMORED: 'armored',
  UNBREAKABLE: 'unbreakable',
});

export const POWER_UP_TYPE = Object.freeze({
  MULTI_BALL: 'multi_ball',
  EXPAND_PADDLE: 'expand_paddle',
  SLOW_BALL: 'slow_ball',
});

export const POWER_UP_DROP_CHANCE = 0.1;

export const COMBO_WINDOW_SEC = 1.5;
export const COMBO_MAX = 8;

export const WORLD = Object.freeze({
  HEIGHT: 20, // y ∈ [-10, 10]
  PADDLE_Y: -8,
  PADDLE_HEIGHT: 0.4,
  PADDLE_WIDTH: 2.4,
  PADDLE_LERP: 18, // higher = snappier
  PADDLE_SPEED: 16, // keyboard paddle speed (world units / sec)
  BALL_RADIUS: 0.3,
  BALL_BASE_SPEED: 12, // units / sec
  BALL_SPEED_PER_LEVEL: 0.5,
  BRICK_WIDTH: 1.8,
  BRICK_HEIGHT: 0.6,
  BRICK_GAP: 0.1,
  BRICK_COLS: 10,
  BRICK_ROWS: 5,
  BRICK_TOP_Y: 7,
  LIVES: 3,
  LOSE_Y: -12,
  SHAKE_DECAY: 0.9,
  FLASH_DECAY: 3.3, // 1 / 0.3s
  STEP_HZ: 60,
});

export const LEVEL_LAYOUT_KEYS = Object.freeze({
  R: { type: BRICK_TYPE.NORMAL, color: 0xef4444, points: 50, hp: 1 },
  Y: { type: BRICK_TYPE.NORMAL, color: 0xfacc15, points: 50, hp: 1 },
  G: { type: BRICK_TYPE.NORMAL, color: 0x22c55e, points: 50, hp: 1 },
  B: { type: BRICK_TYPE.ARMORED, color: 0x3b82f6, points: 100, hp: 2 },
  P: { type: BRICK_TYPE.ARMORED, color: 0xa855f7, points: 100, hp: 3 },
  U: { type: BRICK_TYPE.UNBREAKABLE, color: 0x6b7280, points: 0, hp: Infinity },
});
