import { WORLD } from '../core/constants.js';

/**
 * Input manager — unified keyboard + touch + mouse.
 *
 * Mobile-first: touch position drives the paddle (drag to move), and tap
 * launches the ball.
 *
 * Desktop keyboard: held arrow keys produce a *velocity* (delta per frame),
 * not a snap to the screen edge. The caller integrates the velocity into
 * paddleTargetX using the loop's dt. This fixes the "tap arrow → paddle
 * jumps to edge, then snaps back" bug.
 *
 * Returns (each frame, edge-triggered intents cleared after read):
 *   paddleTargetX  — world X coordinate (number) or null
 *   paddleDelta    — keyboard velocity * dt (number) or 0; caller adds to targetX
 *   launchIntent   — boolean (tap / click / Space)
 *   pauseIntent    — boolean (Esc / P / pause-btn is wired separately in HUD)
 *   restartIntent  — boolean (R key)
 *
 * Priority: when keyboard keys are held, keyboard wins (pointer is ignored).
 * When no movement keys are held, pointer (mouse/touch) drives the target.
 * This prevents the paddle from "snapping back" to the last pointer position
 * after a key is released.
 */

/**
 * Pure function: compute the paddle target X for this frame.
 *
 * @param {Object} params
 * @param {Set<string>} params.keysHeld - Set of currently-held key codes
 * @param {number|null} params.pointerRatio - Normalized 0..1 from pointer, or null
 * @param {number} params.worldWidth - Current world width
 * @param {number} params.dt - Delta time in seconds
 * @param {number} params.paddleSpeed - Keyboard paddle speed (world units/sec)
 * @param {number} params.currentTargetX - Current paddle target X (for velocity integration)
 * @returns {{ targetX: number|null, delta: number }} - targetX is the new paddle target,
 *   delta is the keyboard velocity * dt (0 when keyboard not active).
 *
 * When keys are held, returns a delta to integrate into the current target.
 * When no keys are held, falls back to pointer position (or null if no pointer).
 */
export function computePaddleTargetX({
  keysHeld,
  pointerRatio,
  worldWidth,
  dt,
  paddleSpeed,
  currentTargetX,
}) {
  const left = keysHeld.has('ArrowLeft') || keysHeld.has('KeyA');
  const right = keysHeld.has('ArrowRight') || keysHeld.has('KeyD');

  // Both held → cancel out, no movement. Still counts as "keyboard active"
  // so pointer doesn't take over.
  if (left && right) {
    return { targetX: currentTargetX, delta: 0 };
  }

  if (left) {
    const delta = -paddleSpeed * dt;
    return { targetX: currentTargetX + delta, delta };
  }

  if (right) {
    const delta = paddleSpeed * dt;
    return { targetX: currentTargetX + delta, delta };
  }

  // No movement keys held — fall back to pointer.
  if (pointerRatio != null) {
    return { targetX: -worldWidth / 2 + pointerRatio * worldWidth, delta: 0 };
  }

  // No input at all.
  return { targetX: null, delta: 0 };
}

export function createInputManager(canvas) {
  let lastPointerX = null; // normalized 0..1 across canvas client width
  let launchIntent = false;
  let pauseIntent = false;
  let restartIntent = false;
  let dragging = false;

  // ---------- Keyboard ----------
  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'Space') {
      launchIntent = true;
      e.preventDefault();
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      pauseIntent = true;
      e.preventDefault();
    }
    if (e.code === 'KeyR') {
      restartIntent = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });

  // ---------- Helpers ----------
  function pointerRatioFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    if (rect.width <= 0) return null;
    return Math.max(0, Math.min(1, x / rect.width));
  }

  // ---------- Mouse ----------
  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    const r = pointerRatioFromEvent(e);
    if (r != null) lastPointerX = r;
    launchIntent = true;
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const r = pointerRatioFromEvent(e);
    if (r != null) lastPointerX = r;
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
  });

  // ---------- Touch ----------
  function onTouchStart(e) {
    if (e.touches.length === 0) return;
    e.preventDefault();
    dragging = true;
    const r = pointerRatioFromEvent(e);
    if (r != null) lastPointerX = r;
    launchIntent = true;
  }
  function onTouchMove(e) {
    if (!dragging || e.touches.length === 0) return;
    e.preventDefault();
    const r = pointerRatioFromEvent(e);
    if (r != null) lastPointerX = r;
  }
  function onTouchEnd(e) {
    e.preventDefault();
    dragging = false;
  }
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

  // Track current target for velocity integration across frames
  let currentTargetX = null;

  // ---------- Read (per frame) ----------
  return {
    read(getWorldWidth, dt = 1 / 60) {
      const worldWidth = getWorldWidth();

      // Initialize currentTargetX from pointer if we haven't been set yet
      if (currentTargetX == null && lastPointerX != null) {
        currentTargetX = -worldWidth / 2 + lastPointerX * worldWidth;
      }

      const { targetX, delta } = computePaddleTargetX({
        keysHeld: keys,
        pointerRatio: lastPointerX,
        worldWidth,
        dt,
        paddleSpeed: WORLD.PADDLE_SPEED,
        currentTargetX: currentTargetX ?? 0,
      });

      if (delta !== 0) {
        // Keyboard active — integrate velocity into current target
        currentTargetX = targetX;
      } else if (targetX != null) {
        // Pointer active — snap to pointer position
        currentTargetX = targetX;
      }

      const out = {
        paddleTargetX: currentTargetX,
        launchIntent,
        pauseIntent,
        restartIntent,
      };
      // Consume edges.
      launchIntent = false;
      pauseIntent = false;
      restartIntent = false;
      return out;
    },
    reset() {
      lastPointerX = null;
      dragging = false;
      launchIntent = false;
      pauseIntent = false;
      restartIntent = false;
      currentTargetX = null;
    },
  };
}
