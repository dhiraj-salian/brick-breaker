/**
 * Input manager — unified keyboard + touch + mouse.
 * Mobile-first: touch position drives the paddle (drag to move), and tap
 * launches the ball.
 *
 * Returns (each frame, edge-triggered intents cleared after read):
 *   paddleTargetX  — world X coordinate (number) or null
 *   launchIntent   — boolean (tap / click / Space)
 *   pauseIntent    — boolean (Esc / P / pause-btn is wired separately in HUD)
 *   restartIntent  — boolean (R key)
 */

export function createInputManager(canvas) {
  let paddleTargetX = null;
  let launchIntent = false;
  let pauseIntent = false;
  let restartIntent = false;
  let lastPointerX = null; // normalized 0..1 across canvas client width
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
  // Use passive: false so we can preventDefault and stop the page from
  // trying to scroll/zoom on swipes over the canvas.
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

  // ---------- Read (per frame) ----------
  return {
    read(getWorldWidth) {
      const worldWidth = getWorldWidth();
      let target = paddleTargetX;

      // Keyboard drives paddle to extremes.
      if (keys.has('ArrowLeft') || keys.has('KeyA')) {
        target = -worldWidth / 2;
      } else if (keys.has('ArrowRight') || keys.has('KeyD')) {
        target = worldWidth / 2;
      } else if (lastPointerX != null) {
        // Map normalized pointer position (0..1) to world X.
        target = -worldWidth / 2 + lastPointerX * worldWidth;
      }

      const out = {
        paddleTargetX: target,
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
      paddleTargetX = null;
      lastPointerX = null;
      dragging = false;
      launchIntent = false;
      pauseIntent = false;
      restartIntent = false;
    },
  };
}
