/**
 * HUD — DOM bindings. Pure read from state, write to DOM.
 * Subscribes to no events; main.js calls render() each frame.
 */

const $ = (id) => document.getElementById(id);

let lastStatus = null;
let lastScore = -1;
let lastLives = -1;
let lastCombo = -1;
let lastFlash = 0;

export function createHUD() {
  return {
    render(state) {
      // Score
      if (state.score !== lastScore) {
        $('score-value').textContent = String(state.score);
        lastScore = state.score;
      }
      // Lives
      if (state.lives !== lastLives) {
        $('lives-value').textContent = String(state.lives);
        lastLives = state.lives;
      }
      // Combo
      if (state.combo !== lastCombo) {
        $('combo-value').textContent = String(state.combo);
        $('combo-display').classList.toggle('active', state.combo > 1);
        lastCombo = state.combo;
      }
      // Flash overlay
      if (state.flash !== lastFlash) {
        $('flash-overlay').style.opacity = String(state.flash);
        lastFlash = state.flash;
      }
      // Status overlays
      if (state.status !== lastStatus) {
        showOverlay(state.status, state);
        lastStatus = state.status;
      }
    },
    showMenu() {
      showOverlay('menu', null);
      lastStatus = 'menu';
    },
    showPause() {
      showOverlay('paused', null);
    },
    showGameOver(score) {
      $('final-score').textContent = String(score);
      showOverlay('lost', null);
    },
    showWin(score) {
      $('win-score').textContent = String(score);
      showOverlay('won', null);
    },
  };
}

function showOverlay(status, state) {
  $('menu-overlay').classList.toggle('active', status === 'menu');
  $('pause-overlay').classList.toggle('active', status === 'paused');
  $('gameover-overlay').classList.toggle('active', status === 'lost');
  $('win-overlay').classList.toggle('active', status === 'won');
  $('pause-btn').textContent = status === 'paused' ? 'RESUME' : 'PAUSE';
}

export function setupButtons({ onStart, onPause, onResume, onRestart, onSubmitScore }) {
  $('start-btn').addEventListener('click', onStart);
  $('pause-btn').addEventListener('click', () => {
    if ($('pause-overlay').classList.contains('active')) onResume();
    else onPause();
  });
  $('submit-score-btn').addEventListener('click', () => {
    const name = $('name-input').value.trim() || 'Anonymous';
    onSubmitScore(name);
  });

  // Click anywhere on overlays to restart/continue
  $('gameover-overlay').addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON' && !$('gameover-overlay').querySelector('input')) onRestart();
  });
  $('pause-overlay').addEventListener('click', onResume);

  // Visibility change → auto-pause
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !$('menu-overlay').classList.contains('active')) onPause();
  });
}
