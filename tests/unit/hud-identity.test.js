// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';

// We test the HUD username display functions in isolation.
// The HUD reads from the identity store and renders into DOM elements.

// Set up DOM stubs BEFORE importing the module under test.
function setupDOM() {
  document.body.innerHTML = `
    <div id="hud-top">
      <div id="score-display">SCORE: <span id="score-value">0</span>
        <span id="score-username" class="score-username"></span>
      </div>
      <div id="combo-display">x<span id="combo-value">2</span> COMBO!</div>
      <div id="lives-display">❤️ <span id="lives-value">3</span></div>
      <button id="mute-btn"><span id="mute-icon">🔊</span></button>
      <button id="pause-btn">PAUSE</button>
    </div>
    <div id="menu-overlay" class="overlay active"></div>
    <div id="pause-overlay" class="overlay"></div>
    <div id="gameover-overlay" class="overlay">
      <h2>GAME OVER</h2>
      <p>Final score: <span id="final-score">0</span></p>
      <div id="gameover-username" class="gameover-username"></div>
      <div id="gameover-cta" class="gameover-cta" style="display:none">
        <button id="gameover-signin-btn">SIGN IN TO SAVE</button>
      </div>
      <div id="leaderboard"></div>
      <button id="restart-btn">PLAY AGAIN</button>
    </div>
    <div id="win-overlay" class="overlay">
      <h2>YOU WIN!</h2>
      <p>Final score: <span id="win-score">0</span></p>
      <div id="win-username" class="gameover-username"></div>
      <input id="name-input" type="text" />
      <button id="submit-score-btn">SUBMIT SCORE</button>
      <div id="leaderboard"></div>
      <button id="restart-btn-2">PLAY AGAIN</button>
    </div>
    <div id="flash-overlay"></div>
    <div id="auth-badge"></div>
    <div id="leaderboard-panel">
      <div class="title">🏆 Top Scores</div>
      <div id="leaderboard-list"></div>
    </div>
  `;
}

// Import after DOM setup
const { updateHudIdentity, renderGameOverIdentity } = await import('../../src/ui/hud.js');

describe('HUD identity display', () => {
  beforeEach(() => {
    setupDOM();
  });

  describe('updateHudIdentity', () => {
    it('shows @username in score display when logged in', () => {
      updateHudIdentity({ username: 'alice' });
      const el = document.getElementById('score-username');
      expect(el.textContent).toBe(' @alice');
      expect(el.style.display).not.toBe('none');
    });

    it('hides username when not logged in', () => {
      updateHudIdentity(null);
      const el = document.getElementById('score-username');
      expect(el.textContent).toBe('');
    });

    it('shows auth badge with username when logged in', () => {
      updateHudIdentity({ username: 'bob' });
      const badge = document.getElementById('auth-badge');
      expect(badge.textContent).toContain('bob');
      expect(badge.style.display).toBe('block');
    });

    it('hides auth badge when not logged in', () => {
      updateHudIdentity(null);
      const badge = document.getElementById('auth-badge');
      expect(badge.style.display).toBe('none');
    });
  });

  describe('renderGameOverIdentity', () => {
    it('shows @username — score pts on game-over when logged in', () => {
      renderGameOverIdentity({ username: 'alice' }, 1240, 3);
      const el = document.getElementById('gameover-username');
      expect(el.textContent).toContain('@alice');
      expect(el.textContent).toContain('1240');
      expect(el.style.display).not.toBe('none');
    });

    it('hides username line when not logged in', () => {
      renderGameOverIdentity(null, 500, 1);
      const el = document.getElementById('gameover-username');
      expect(el.style.display).toBe('none');
    });

    it('shows sign-in CTA when not logged in', () => {
      renderGameOverIdentity(null, 500, 1);
      const cta = document.getElementById('gameover-cta');
      expect(cta.style.display).not.toBe('none');
    });

    it('hides sign-in CTA when logged in', () => {
      renderGameOverIdentity({ username: 'alice' }, 500, 1);
      const cta = document.getElementById('gameover-cta');
      expect(cta.style.display).toBe('none');
    });

    it('includes combo info in game-over text', () => {
      renderGameOverIdentity({ username: 'alice' }, 1240, 3);
      const el = document.getElementById('gameover-username');
      expect(el.textContent).toContain('×3');
    });
  });
});
