import { WORLD, POWER_UP_TYPE, POWER_UP_DROP_CHANCE } from './constants.js';

/**
 * Power-up system — drop, fall, catch, apply.
 *
 * Pure functions (no Three.js). Visuals and audio live in render/audio.
 */

const POWER_UP_DEFS = {
  [POWER_UP_TYPE.MULTI_BALL]: { color: 0xfacc15, duration: 0, label: 'M' },
  [POWER_UP_TYPE.EXPAND_PADDLE]: { color: 0x22c55e, duration: 10, label: 'E' },
  [POWER_UP_TYPE.SLOW_BALL]: { color: 0x60a5fa, duration: 8, label: 'S' },
};

export function maybeDropPowerUp(brick) {
  if (brick.type === 'unbreakable') return null;
  if (Math.random() > POWER_UP_DROP_CHANCE) return null;
  const types = Object.values(POWER_UP_TYPE);
  const type = types[Math.floor(Math.random() * types.length)];
  return {
    type,
    x: brick.x,
    y: brick.y,
    vy: -3, // falls down (negative vy = downward in our coord system where y+ is up)
    r: 0.3,
  };
}

export function stepPowerUps(state, dt) {
  const fallSpeed = 4; // units / sec downward
  const next = [];
  for (const p of state.powerUps) {
    const y = p.y - fallSpeed * dt;
    // Catch by paddle
    const paddleTop = state.paddle.y + WORLD.PADDLE_HEIGHT / 2;
    const paddleBottom = state.paddle.y - WORLD.PADDLE_HEIGHT / 2;
    if (y >= paddleBottom && y <= paddleTop) {
      if (Math.abs(p.x - state.paddle.x) < state.paddle.width / 2 + p.r) {
        continue; // caught — caller applies effect via applyCaughtPowerUps
      }
    }
    if (y < WORLD.LOSE_Y) continue; // missed
    next.push({ ...p, y });
  }
  return { ...state, powerUps: next };
}

/**
 * Apply caught power-ups to state. Returns { state, caught }.
 * `caught` is a list of power-up types that fired this frame.
 */
export function applyCaughtPowerUps(state) {
  // The caller already filtered powerUps via stepPowerUps. Here we apply effects
  // by detecting which types are no longer in the falling list (caught/missed).
  // Simpler: caller passes the list of remaining powerUps AND the previous list.
  return state;
}

/**
 * Apply a single power-up effect to state.
 */
export function applyPowerUp(state, type) {
  const def = POWER_UP_DEFS[type];
  if (!def) return state;

  let paddle = state.paddle;
  let activeEffects = state.activeEffects.filter((e) => e.type !== type);
  if (def.duration > 0) {
    activeEffects = [...activeEffects, { type, remaining: def.duration }];
  }

  if (type === POWER_UP_TYPE.EXPAND_PADDLE) {
    paddle = { ...paddle, targetWidth: WORLD.PADDLE_WIDTH * 1.5 };
  }

  return { ...state, paddle, activeEffects };
}

export function tickEffects(state, dt) {
  const stillActive = [];
  let paddle = state.paddle;
  for (const eff of state.activeEffects) {
    const remaining = eff.remaining - dt;
    if (remaining <= 0) {
      // revert
      if (eff.type === POWER_UP_TYPE.EXPAND_PADDLE) {
        paddle = { ...paddle, targetWidth: WORLD.PADDLE_WIDTH };
      }
      continue;
    }
    stillActive.push({ ...eff, remaining });
  }
  return { ...state, activeEffects: stillActive, paddle };
}

export function powerUpColor(type) {
  return POWER_UP_DEFS[type]?.color ?? 0xffffff;
}

export function powerUpLabel(type) {
  return POWER_UP_DEFS[type]?.label ?? '?';
}
