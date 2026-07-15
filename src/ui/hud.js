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
        // Subtle bounce on combo growth.
        if (state.combo > lastCombo && state.combo > 1) {
          const el = $('combo-display');
          el.style.transform = 'scale(1.25)';
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.style.transform = 'scale(1)';
            });
          });
        }
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

function showOverlay(status, _state) {
  $('menu-overlay').classList.toggle('active', status === 'menu');
  $('pause-overlay').classList.toggle('active', status === 'paused');
  $('gameover-overlay').classList.toggle('active', status === 'lost');
  $('win-overlay').classList.toggle('active', status === 'won');
  $('pause-btn').textContent = status === 'paused' ? 'RESUME' : 'PAUSE';
  // Hide floating leaderboard panel during overlays (avoids visual clutter).
  const panel = $('leaderboard-panel');
  if (panel) panel.style.opacity = status === 'playing' ? '1' : '0.35';
  // Show/hide auth badge during gameplay
  const badge = $('auth-badge');
  if (badge) badge.style.display = status === 'playing' ? 'block' : 'none';
}

export function setupButtons({
  onStart,
  onPause,
  onResume,
  onRestart,
  onSubmitScore,
  onToggleMute,
  isMuted,
  onLogin,
  onRegister,
  onLogout,
}) {
  // Start
  $('start-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    onStart();
  });
  // Pause toggle button (top-right).
  $('pause-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if ($('pause-overlay').classList.contains('active')) onResume();
    else onPause();
  });
  // Mute toggle.
  const muteBtn = $('mute-btn');
  const muteIcon = $('mute-icon');
  // Initialize icon from persisted state.
  if (isMuted()) {
    muteIcon.textContent = '🔇';
    muteBtn.classList.add('muted');
  } else {
    muteIcon.textContent = '🔊';
    muteBtn.classList.remove('muted');
  }
  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const nowMuted = onToggleMute();
    muteIcon.textContent = nowMuted ? '🔇' : '🔊';
    muteBtn.classList.toggle('muted', nowMuted);
  });
  // Resume button (on pause overlay).
  $('resume-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    onResume();
  });
  // Restart button (on gameover overlay).
  $('restart-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    onRestart();
  });
  // Restart button (on win overlay).
  $('restart-btn-2').addEventListener('click', (e) => {
    e.stopPropagation();
    onRestart();
  });
  // Submit score.
  $('submit-score-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const name = $('name-input').value.trim() || 'Anonymous';
    onSubmitScore(name);
  });

  // Auth buttons (on menu overlay).
  if (onLogin) {
    $('login-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const u = $('auth-user').value.trim();
      const p = $('auth-pass').value;
      if (!u || !p) {
        $('auth-error').textContent = 'Enter username and password';
        return;
      }
      onLogin(u, p);
    });
  }
  if (onRegister) {
    $('register-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const u = $('auth-user').value.trim();
      const p = $('auth-pass').value;
      if (!u || !p) {
        $('auth-error').textContent = 'Enter username and password';
        return;
      }
      onRegister(u, p);
    });
  }
  if (onLogout) {
    $('logout-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      onLogout();
    });
  }

  // Enter key in password field triggers login
  $('auth-pass').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('login-btn').click();
    }
  });

  // Tap-to-resume on the pause overlay (anywhere except buttons).
  $('pause-overlay').addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') onResume();
  });
  // Tap-to-restart on gameover overlay (anywhere except buttons).
  $('gameover-overlay').addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') onRestart();
  });

  // Visibility change → auto-pause when tab/app is hidden mid-game.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !$('menu-overlay').classList.contains('active')) onPause();
  });
}

/**
 * Update the auth UI in the menu overlay.
 * @param {{username: string|null}} user - current user or null
 */
export function updateAuthUI(user) {
  const loggedIn = $('auth-logged-in');
  const form = $('auth-form');
  const badge = $('auth-badge');
  if (user && user.username) {
    loggedIn.style.display = 'block';
    form.style.display = 'none';
    $('auth-username').textContent = user.username;
    badge.textContent = `Playing as: ${user.username}`;
    badge.style.display = 'block';
  } else {
    loggedIn.style.display = 'none';
    form.style.display = 'block';
    badge.style.display = 'none';
  }
  // Clear error + password
  $('auth-error').textContent = '';
  $('auth-pass').value = '';
}

/**
 * Show an auth error message.
 * @param {string} msg
 */
export function showAuthError(msg) {
  $('auth-error').textContent = msg;
}

/**
 * Render the floating leaderboard panel (always visible during gameplay).
 * @param {Array<{name:string, score:number, ts:number, username?:string}>} scores
 * @param {number|null} currentPlayerScore - Highlights if in top 5
 * @param {string|null} currentUsername - Highlights the current user's row
 */
export function renderLeaderboardPanel(scores, currentPlayerScore = null, currentUsername = null) {
  const el = $('leaderboard-list');
  if (!el) return;
  if (!scores || scores.length === 0) {
    el.innerHTML = '<div class="empty">No scores yet — be the first!</div>';
    return;
  }
  const top = scores.slice(0, 5);
  el.innerHTML = top
    .map((s, i) => {
      const isMe =
        (currentUsername && s.username === currentUsername) ||
        (currentPlayerScore !== null && s.score === currentPlayerScore);
      return `<div class="row ${isMe ? 'me' : ''}">
          <span class="rank">${i + 1}.</span>
          <span class="name">${escapeHtml(s.name)}</span>
          <span class="score">${s.score}</span>
        </div>`;
    })
    .join('');
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}
