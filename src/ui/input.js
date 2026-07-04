/**
 * Input manager — unified keyboard + touch + mouse.
 * Reads world X from screen X via canvas bounds.
 *
 * Returns:
 *   paddleTargetX  — number or null
 *   launchIntent   — boolean (edge-triggered)
 *   pauseIntent    — boolean (edge-triggered)
 *   restartIntent  — boolean (edge-triggered)
 */

export function createInputManager(canvas) {
  let paddleTargetX = null;
  let launchIntent = false;
  let pauseIntent = false;
  let restartIntent = false;
  let lastPointerX = null;
  let lastTouchX = null;

  // Keyboard
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

  // Mouse
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    lastPointerX = e.clientX - rect.left;
  });
  canvas.addEventListener('mousedown', () => {
    launchIntent = true;
  });

  // Touch
  canvas.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      lastTouchX = t.clientX - rect.left;
      lastPointerX = lastTouchX;
      launchIntent = true;
    },
    { passive: false }
  );
  canvas.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      lastTouchX = t.clientX - rect.left;
      lastPointerX = lastTouchX;
    },
    { passive: false }
  );

  return {
    read(getWorldWidth) {
      let target = paddleTargetX;

      // Keyboard
      if (keys.has('ArrowLeft') || keys.has('KeyA')) {
        target = -1; // far left
      } else if (keys.has('ArrowRight') || keys.has('KeyD')) {
        target = 1;
      } else if (lastPointerX != null) {
        // Pointer position
        const ratio = lastPointerX / canvas.clientWidth;
        target = -1 + ratio * 2;
      }

      const out = {
        paddleTargetX: target == null ? null : target * (getWorldWidth() / 2),
        launchIntent,
        pauseIntent,
        restartIntent,
      };
      // Consume edges
      launchIntent = false;
      pauseIntent = false;
      restartIntent = false;
      return out;
    },
  };
}
