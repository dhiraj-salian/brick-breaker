/**
 * Brick-Breaker — main entry.
 * Wires game state, physics, render, input, HUD, audio.
 */
import * as THREE from 'three';
import { createScene } from './render/scene.js';
import {
  createPaddleMesh,
  createBallMesh,
  createBrickMeshes,
  updateBrickMesh,
  createPowerUpMesh,
} from './render/meshes.js';
import { createParticleSystem } from './render/particles.js';
import { applyCameraShake } from './render/camera-controller.js';
import {
  createHUD,
  setupButtons,
  renderLeaderboardPanel,
  updateAuthUI,
  updateHudIdentity,
  renderGameOverIdentity,
  showAuthError,
} from './ui/hud.js';
import { createInputManager } from './ui/input.js';
import { sfx, resumeAudio, isMuted, toggleMuted } from './audio/sfx.js';
import {
  powerUpColor,
  maybeDropPowerUp,
  applyPowerUp,
  tickEffects,
} from './core/power-up-system.js';
import { splitBall } from './core/ball-controller.js';
import {
  createInitialState,
  startGame,
  pause,
  resume,
  loseLife,
  winGame,
  REQUIRED_WORLD_WIDTH,
} from './core/game-state.js';
import { parseLayout, allBricksBroken } from './core/brick-grid.js';
import { stepPhysics } from './core/physics-stepper.js';
import {
  detectBrickCollisions,
  detectPaddleCollision,
  bounceBall,
  safeNormalize,
} from './core/collision-detector.js';
import { updatePaddleTarget, attachBallToPaddle, launchBall } from './core/paddle-controller.js';
import { reattachLostBalls } from './core/ball-controller.js';
import { calculateScore } from './core/score-calculator.js';
import { registerHit, tickCombo, resetCombo } from './core/combo-system.js';
import { STATUS, POWER_UP_TYPE, WORLD } from './core/constants.js';
import { generateDefaultName } from './core/default-name.js';
import { createIdentityStore } from './core/identity.js';
import { LEVELS } from './levels/levels.js';
import { submitScore, fetchTopScores } from './net/leaderboard.js';
import { register, login, getMe, logout, loadSession } from './net/auth.js';

const STEP = 1 / WORLD.STEP_HZ;

const canvas = document.getElementById('game-canvas');
const sceneRender = createScene(canvas);
const { renderer, scene, camera, resize, playLight } = sceneRender;
let worldWidth = 14;

// Game state
let state = createInitialState(1);
let accumulator = 0;
let lastTime = performance.now();
let topCombo = 1; // Track highest combo reached for game-over display

// Meshes
const paddleMesh = createPaddleMesh();
scene.add(paddleMesh);

let ballMeshes = []; // one per ball in state.balls
const ballGroup = new THREE.Group();
scene.add(ballGroup);

let brickMesh = null;
const brickGroup = new THREE.Group();
scene.add(brickGroup);

const particleSystem = createParticleSystem();
scene.add(particleSystem.mesh);

// Power-up meshes pool
const powerUpGroup = new THREE.Group();
scene.add(powerUpGroup);

function loadLevel(levelIndex) {
  const level = LEVELS[levelIndex];
  if (!level) return false;

  // Remove old brick mesh
  if (brickMesh) {
    brickGroup.remove(brickMesh);
    brickMesh.geometry.dispose();
    brickMesh.material.dispose();
  }
  // Remove old power-up meshes
  while (powerUpGroup.children.length) {
    const c = powerUpGroup.children[0];
    powerUpGroup.remove(c);
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
  }

  const bricks = parseLayout(level.layout);
  const init = createInitialState(levelIndex + 1);
  // Preserve current status (don't reset to menu during gameplay)
  state = {
    ...state,
    status: state.status === STATUS.MENU ? STATUS.PLAYING : state.status,
    level: levelIndex + 1,
    bricks,
    paddle: init.paddle,
    balls: [],
    powerUps: [],
    activeEffects: [],
    combo: 1,
    comboTimer: 0,
  };
  state = attachBallToPaddle(state);

  brickMesh = createBrickMeshes(bricks);
  brickGroup.add(brickMesh);
  return true;
}

function syncBallMeshes() {
  // Add missing
  while (ballMeshes.length < state.balls.length) {
    const m = createBallMesh();
    ballMeshes.push(m);
    ballGroup.add(m);
  }
  // Remove extras
  while (ballMeshes.length > state.balls.length) {
    const m = ballMeshes.pop();
    ballGroup.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  }
  // Update positions
  state.balls.forEach((b, i) => {
    ballMeshes[i].position.set(b.x, b.y, 0);
  });
}

function syncPowerUpMeshes() {
  // Naive: clear and rebuild. Power-up count is small.
  while (powerUpGroup.children.length) {
    const c = powerUpGroup.children[0];
    powerUpGroup.remove(c);
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
    if (c.userData?.halo?.material) c.userData.halo.material.dispose();
  }
  const t = performance.now() / 1000;
  state.powerUps.forEach((p, i) => {
    const mesh = createPowerUpMesh(p.type, powerUpColor(p.type));
    mesh.position.set(p.x, p.y, 0);
    // Slow rotation + bob.
    if (mesh.userData?.core) {
      mesh.userData.core.rotation.x = t * 1.4 + i;
      mesh.userData.core.rotation.y = t * 1.7 + i;
    }
    mesh.position.y += Math.sin(t * 3 + i) * 0.1;
    powerUpGroup.add(mesh);
  });
}

function applyEvents(events) {
  for (const ev of events) {
    if (ev.type === 'BRICK_HIT') {
      // Bounce ball
      const idx = state.balls.indexOf(ev.ball);
      if (idx >= 0) {
        const speed = Math.hypot(ev.ball.vx, ev.ball.vy);
        state.balls[idx] = bounceBall(ev.ball, ev.nx, ev.ny, speed);
      }
      // Damage brick
      if (ev.brick.type === 'unbreakable') {
        sfx.wallBounce();
        continue;
      }
      ev.brick.hp -= 1;
      if (ev.brick.hp <= 0) {
        ev.brick.broken = true;
        // Score + combo
        state = registerHit(state);
        if (state.combo > topCombo) topCombo = state.combo;
        const points = calculateScore({
          base: ev.brick.points,
          combo: state.combo,
          bonuses: 0,
        });
        state.score += points;
        sfx.brickBreak();
        particleSystem.emit(ev.brick.x, ev.brick.y, ev.brick.color, 8);
        vibrate(20);
        // Drop power-up?
        const drop = maybeDropPowerUp(ev.brick);
        if (drop) state.powerUps.push(drop);
      } else {
        sfx.wallBounce();
      }
    } else if (ev.type === 'PADDLE_HIT') {
      const idx = state.balls.indexOf(ev.ball);
      if (idx >= 0) {
        const speed = Math.hypot(ev.ball.vx, ev.ball.vy);
        const bounced = bounceBall(ev.ball, 0, 1, Math.max(speed, WORLD.BALL_BASE_SPEED));
        // Apply spin. SPIN_INFLUENCE controls how much horizontal velocity
        // the ball gets per unit paddle-offset. With BASE_SPEED=12, a value
        // of 9 gives a max launch angle of ~49° from vertical — enough to
        // comfortably reach the outermost brick columns (cx ≈ ±8.5) with
        // only ~75% paddle offset (rather than requiring a perfect edge hit).
        bounced.vx += ev.spin * 9;
        // Re-normalize (safe)
        const norm = safeNormalize(bounced.vx, bounced.vy, WORLD.BALL_BASE_SPEED);
        bounced.vx = norm.vx;
        bounced.vy = norm.vy;
        // Ensure upward
        if (bounced.vy < 0) bounced.vy = -bounced.vy;
        state.balls[idx] = bounced;
        sfx.paddleHit(ev.spin);
        state = resetCombo(state);
      }
    }
  }
}

function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function physicsStep(dt) {
  // Apply input
  state = updatePaddleTarget(state, paddleTargetOverride ?? state.paddle.targetX);

  // Step physics (paddle lerp, ball move, wall bounce)
  state = stepPhysics(state, dt);

  // Detect & apply collisions
  const brickEvents = detectBrickCollisions(state);
  applyEvents(brickEvents);

  // Paddle collisions
  const paddleEvents = [];
  for (const ball of state.balls) {
    const hit = detectPaddleCollision(ball, state.paddle);
    if (hit) paddleEvents.push({ type: 'PADDLE_HIT', ball, spin: hit.spin });
  }
  applyEvents(paddleEvents);

  // Power-ups: catch + apply
  const caught = [];
  const next = [];
  for (const p of state.powerUps) {
    const dy = p.y - state.paddle.y;
    if (
      dy >= -WORLD.PADDLE_HEIGHT &&
      dy <= WORLD.PADDLE_HEIGHT &&
      Math.abs(p.x - state.paddle.x) < state.paddle.width / 2 + p.r
    ) {
      caught.push(p);
    } else {
      next.push(p);
    }
  }
  state.powerUps = next;
  for (const p of caught) {
    state = applyPowerUp(state, p.type);
    sfx.powerUp();
    // MULTI_BALL: instant spawn
    if (p.type === POWER_UP_TYPE.MULTI_BALL) {
      const newBalls = state.balls.flatMap((b) => splitBall(b, 2));
      state.balls = newBalls;
    }
  }

  // Effects tick
  state = tickEffects(state, dt);
  // Combo tick
  state = tickCombo(state, dt);

  // Apply SLOW_BALL effect
  if (state.activeEffects.some((e) => e.type === POWER_UP_TYPE.SLOW_BALL)) {
    state.balls = state.balls.map((b) => ({ ...b, vx: b.vx * 0.7, vy: b.vy * 0.7 }));
  }

  // Apply EXPAND_PADDLE: lerp paddle.width toward targetWidth
  const wDiff = state.paddle.targetWidth - state.paddle.width;
  state.paddle.width += wDiff * Math.min(1, dt * 10);

  // Step power-ups (fall)
  const fallSpeed = 4;
  state.powerUps = state.powerUps
    .map((p) => ({ ...p, y: p.y - fallSpeed * dt }))
    .filter((p) => p.y > WORLD.LOSE_Y);

  // Re-attach ball if lost
  if (state._lostBall && state.balls.length === 0) {
    const wasPlaying = state.status === STATUS.PLAYING;
    state = reattachLostBalls(state);
    state = loseLife(state);
    if (state.status === STATUS.LOST) {
      sfx.lose();
      state.shake.intensity = 1.0;
      state.flash = 1.0;
      hud.showGameOver(state.score);
      renderGameOverIdentity(identity.getUser(), state.score, topCombo);
      // Only auto-submit if we transitioned from PLAYING→LOST on this step.
      if (wasPlaying) autoSubmitScore();
    } else {
      state.shake.intensity = 0.5;
    }
    delete state._lostBall;
  }

  // Check win condition
  if (state.status === STATUS.PLAYING && allBricksBroken(state.bricks)) {
    if (state.level >= LEVELS.length) {
      state = winGame(state);
      sfx.win();
      hud.showWin(state.score);
      renderGameOverIdentity(identity.getUser(), state.score, topCombo);
      autoSubmitScore();
    } else {
      // Advance to next level (simplified: reset state for next level)
      loadLevel(state.level); // level index = state.level (0-based after advance)
    }
  }

  // Sync attached ball to paddle (well above so collision doesn't trigger)
  state.balls = state.balls.map((b) =>
    b.attached
      ? { ...b, x: state.paddle.x, y: state.paddle.y + WORLD.PADDLE_HEIGHT / 2 + b.r + 0.2 }
      : b
  );
}

let paddleTargetOverride = null;

const input = createInputManager(canvas);
const hud = createHUD();

setupButtons({
  onStart: () => {
    resumeAudio();
    state = startGame(state);
    topCombo = 1;
    loadLevel(0);
    refreshLeaderboard();
  },
  onPause: () => {
    if (state.status === STATUS.PLAYING) {
      state = pause(state);
    }
  },
  onResume: () => {
    if (state.status === STATUS.PAUSED) state = resume(state);
  },
  onRestart: () => {
    state = createInitialState(1);
    topCombo = 1;
    loadLevel(0);
    hud.showMenu();
    refreshLeaderboard();
  },
  onSubmitScore: async (name) => {
    try {
      await submitScore(name, state.score);
      const top = await fetchTopScores(10);
      renderLeaderboard(top);
      renderLeaderboardPanel(top, state.score, identity.getUsername());
    } catch (e) {
      console.error('Score submit failed', e);
    }
  },
  onToggleMute: () => toggleMuted(),
  isMuted: () => isMuted(),
  onLogin: async (username, password) => {
    try {
      const result = await login(username, password);
      if (result.ok) {
        identity.setUser({ username: result.username });
        refreshLeaderboard();
      } else {
        showAuthError(result.error || 'Login failed');
      }
    } catch (e) {
      showAuthError('Network error');
    }
  },
  onRegister: async (username, password) => {
    try {
      const result = await register(username, password);
      if (result.ok) {
        identity.setUser({ username: result.username });
        refreshLeaderboard();
      } else {
        showAuthError(result.error || 'Registration failed');
      }
    } catch (e) {
      showAuthError('Network error');
    }
  },
  onLogout: () => {
    logout();
    identity.setUser(null);
    refreshLeaderboard();
  },
  onSignIn: () => {
    // Dismiss game-over / win overlays and show menu (with auth form)
    document.getElementById('gameover-overlay').classList.remove('active');
    document.getElementById('win-overlay').classList.remove('active');
    document.getElementById('menu-overlay').classList.add('active');
    // Focus the username input for convenience
    const userInput = document.getElementById('auth-user');
    if (userInput) userInput.focus();
  },
});

async function refreshLeaderboard() {
  try {
    const top = await fetchTopScores(10);
    renderLeaderboard(top);
    renderLeaderboardPanel(top, state.score, identity.getUsername());
  } catch (e) {
    /* leaderboard fetch failed — non-critical */
  }
}

/**
 * Auto-submit the current score.
 *
 * When logged in, submits via the authenticated path (the worker attaches
 * the username from the token). When anonymous, generates a default name
 * and submits via the legacy path.
 *
 * Called from the WIN and LOST transitions so players never lose their
 * score by forgetting to type a name. Skips submission when score is 0.
 */
async function autoSubmitScore() {
  if (!state.score || state.score <= 0) return;
  const name = identity.isLoggedIn() ? identity.getUsername() : generateDefaultName();
  try {
    await submitScore(name, state.score);
    // Refresh panel so the saved entry shows up immediately.
    const top = await fetchTopScores(10);
    renderLeaderboard(top);
    renderLeaderboardPanel(top, state.score, identity.getUsername());
  } catch (e) {
    /* network or HMAC failure — non-critical */
  }
}

function renderLeaderboard(scores) {
  document.querySelectorAll('#leaderboard').forEach((el) => {
    if (!el) return;
    if (!scores || scores.length === 0) {
      el.innerHTML = '<p style="opacity:0.5;font-size:13px">No scores yet</p>';
      return;
    }
    el.innerHTML = scores
      .map((s, i) => {
        const displayName = s.username ? `@${s.username}` : escapeHtml(s.name);
        return `<div class="row"><span>${i + 1}. ${displayName}</span><span>${s.score}</span></div>`;
      })
      .join('');
  });
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

// Identity store — single source of truth for "who is playing"
const identity = createIdentityStore();

// Subscribe to identity changes → update HUD + auth UI
identity.subscribe((user) => {
  updateAuthUI(user);
  updateHudIdentity(user);
});

// On startup, check for existing session
async function initAuth() {
  // First, try to populate from localStorage (instant, no network)
  identity.initFromSession();
  // Then verify the token with the server
  const session = loadSession();
  if (!session) return;
  try {
    const result = await getMe(session.token);
    if (result.ok) {
      identity.setUser({ username: result.username });
    } else {
      // Token expired or invalid — clear it
      logout();
      identity.setUser(null);
    }
  } catch {
    // Network error — keep the session from localStorage
    // identity already populated from initFromSession above
  }
}
initAuth();

// Load leaderboard on init
refreshLeaderboard();

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  // Read input — pass dt so keyboard velocity integrates per frame
  const i = input.read(() => worldWidth, dt);
  if (i.paddleTargetX != null) paddleTargetOverride = i.paddleTargetX;
  if (i.pauseIntent) {
    if (state.status === STATUS.PLAYING) state = pause(state);
    else if (state.status === STATUS.PAUSED) state = resume(state);
  }
  if (i.restartIntent) {
    state = createInitialState(1);
    topCombo = 1;
    loadLevel(0);
    hud.showMenu();
  }
  if (i.launchIntent) {
    resumeAudio();
    const attached = state.balls.find((b) => b.attached);
    if (attached) {
      state = launchBall(state);
      sfx.launch();
    }
  }

  // Resize
  const { worldWidth: ww } = resize();
  worldWidth = ww;
  // Keep physics world width in sync with the camera frustum so the ball
  // doesn't bounce off invisible walls short of the outermost bricks.
  // Never let it drop below REQUIRED_WORLD_WIDTH (imported via game-state).
  state.worldWidth = Math.max(ww, REQUIRED_WORLD_WIDTH);

  // Step physics (fixed-step accumulator)
  if (state.status === STATUS.PLAYING) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      physicsStep(STEP);
      accumulator -= STEP;
      steps++;
    }
    if (steps === 5) accumulator = 0;
  } else {
    accumulator = 0;
  }

  // Render
  paddleMesh.position.set(state.paddle.x, state.paddle.y, 0);
  paddleMesh.scale.set(state.paddle.width, 1, 1);

  syncBallMeshes();

  if (brickMesh) updateBrickMesh(brickMesh, state.bricks);
  syncPowerUpMeshes();
  particleSystem.update(dt);
  applyCameraShake(camera, state.shake);

  hud.render(state);

  // Subtle play-light pulse while playing.
  if (playLight) {
    const target = state.status === STATUS.PLAYING ? 0.9 : 0.35;
    playLight.intensity += (target - playLight.intensity) * 0.05;
    playLight.position.x = Math.sin(now / 1500) * 2;
  }

  renderer.render(scene, camera);

  // Periodic leaderboard refresh (every 15s while playing) so players see
  // other people's scores climbing in real time.
  leaderboardTimer += dt;
  if (leaderboardTimer > 15 && state.status === STATUS.PLAYING) {
    leaderboardTimer = 0;
    refreshLeaderboard();
  }

  requestAnimationFrame(loop);
}

let leaderboardTimer = 0;

window.addEventListener('resize', () => resize());

// Debug helper
window.__getState = () => state;
requestAnimationFrame((t) => {
  lastTime = t;
  loop(t);
});
