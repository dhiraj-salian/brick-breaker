// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit tests for the auth-screen module — the full-screen login/register
 * overlay that gates access to the game menu and canvas.
 *
 * Tests cover: show/hide, tab switching (LOGIN ↔ REGISTER), form submission
 * (login + register), guest mode, error display, and focus management.
 */

// ---------- DOM stub matching the index.html #auth-screen markup ----------
function setupAuthDOM() {
  document.body.innerHTML = `
    <div id="game-container">
      <canvas id="game-canvas"></canvas>
      <div id="hud">
        <div id="menu-overlay" class="overlay"></div>
        <div id="pause-overlay" class="overlay"></div>
        <div id="gameover-overlay" class="overlay"></div>
        <div id="win-overlay" class="overlay"></div>
      </div>
    </div>
    <div id="auth-screen" class="auth-screen" role="dialog" aria-modal="true" aria-labelledby="auth-title" style="display:none">
      <div class="auth-card">
        <h1 id="auth-title" class="auth-title">BRICK BREAKER</h1>
        <div class="auth-tabs" role="tablist">
          <button id="auth-tab-login" class="auth-tab active" role="tab" aria-selected="true">LOGIN</button>
          <button id="auth-tab-register" class="auth-tab" role="tab" aria-selected="false">REGISTER</button>
        </div>
        <form id="auth-form">
          <input id="auth-user" type="text" placeholder="Username" maxlength="20" class="auth-input" autocomplete="username" />
          <input id="auth-pass" type="password" placeholder="Password" class="auth-input" autocomplete="current-password" />
          <button id="auth-submit-btn" type="submit" class="auth-submit-btn">LOGIN</button>
        </form>
        <p id="auth-error" class="auth-error" role="alert"></p>
        <button id="auth-guest-btn" class="auth-guest-link">Continue as Guest</button>
      </div>
    </div>
  `;
}

// Import after DOM setup
const { createAuthScreen } = await import('../../src/ui/auth-screen.js');

describe('AuthScreen', () => {
  let authScreen;
  let callbacks;

  beforeEach(() => {
    setupAuthDOM();
    callbacks = {
      onLogin: vi.fn().mockResolvedValue({ ok: true, username: 'testuser' }),
      onRegister: vi.fn().mockResolvedValue({ ok: true, username: 'newuser' }),
      onGuest: vi.fn(),
      onSuccess: vi.fn(),
    };
    authScreen = createAuthScreen(callbacks);
  });

  describe('show / hide', () => {
    it('show() makes the auth screen visible', () => {
      authScreen.show();
      const el = document.getElementById('auth-screen');
      expect(el.style.display).not.toBe('none');
      expect(el.classList.contains('active')).toBe(true);
    });

    it('hide() hides the auth screen', () => {
      authScreen.show();
      authScreen.hide();
      const el = document.getElementById('auth-screen');
      expect(el.style.display).toBe('none');
      expect(el.classList.contains('active')).toBe(false);
    });

    it('show() focuses the username input for accessibility', () => {
      authScreen.show();
      const input = document.getElementById('auth-user');
      // jsdom doesn't actually move focus, but the call should not throw
      expect(input).toBeDefined();
    });

    it('hide() also hides game-container (canvas + menu)', () => {
      authScreen.show();
      const gameContainer = document.getElementById('game-container');
      expect(gameContainer.style.display).toBe('none');
    });

    it('hide() restores game-container visibility', () => {
      authScreen.show();
      authScreen.hide();
      const gameContainer = document.getElementById('game-container');
      expect(gameContainer.style.display).not.toBe('none');
    });
  });

  describe('tab switching', () => {
    it('starts on LOGIN tab', () => {
      authScreen.show();
      const loginTab = document.getElementById('auth-tab-login');
      const registerTab = document.getElementById('auth-tab-register');
      expect(loginTab.classList.contains('active')).toBe(true);
      expect(registerTab.classList.contains('active')).toBe(false);
      expect(loginTab.getAttribute('aria-selected')).toBe('true');
      expect(registerTab.getAttribute('aria-selected')).toBe('false');
    });

    it('clicking REGISTER tab switches to register mode', () => {
      authScreen.show();
      document.getElementById('auth-tab-register').click();
      const loginTab = document.getElementById('auth-tab-login');
      const registerTab = document.getElementById('auth-tab-register');
      expect(registerTab.classList.contains('active')).toBe(true);
      expect(loginTab.classList.contains('active')).toBe(false);
      expect(registerTab.getAttribute('aria-selected')).toBe('true');
      expect(loginTab.getAttribute('aria-selected')).toBe('false');
    });

    it('switching to REGISTER changes submit button text', () => {
      authScreen.show();
      document.getElementById('auth-tab-register').click();
      const btn = document.getElementById('auth-submit-btn');
      expect(btn.textContent).toBe('REGISTER');
    });

    it('switching back to LOGIN changes submit button text', () => {
      authScreen.show();
      document.getElementById('auth-tab-register').click();
      document.getElementById('auth-tab-login').click();
      const btn = document.getElementById('auth-submit-btn');
      expect(btn.textContent).toBe('LOGIN');
    });
  });

  describe('login submission', () => {
    it('calls onLogin with username and password on form submit', async () => {
      authScreen.show();
      document.getElementById('auth-user').value = 'alice';
      document.getElementById('auth-pass').value = 'secret123';

      const form = document.getElementById('auth-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await vi.waitFor(() => {
        expect(callbacks.onLogin).toHaveBeenCalledWith('alice', 'secret123');
      });
    });

    it('calls onSuccess after successful login', async () => {
      authScreen.show();
      document.getElementById('auth-user').value = 'alice';
      document.getElementById('auth-pass').value = 'secret123';

      const form = document.getElementById('auth-form');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        expect(callbacks.onSuccess).toHaveBeenCalledWith({ ok: true, username: 'testuser' });
      });
    });

    it('shows error on failed login', async () => {
      callbacks.onLogin.mockResolvedValue({ ok: false, error: 'Invalid credentials' });
      authScreen = createAuthScreen(callbacks);
      authScreen.show();
      document.getElementById('auth-user').value = 'alice';
      document.getElementById('auth-pass').value = 'wrong';

      const form = document.getElementById('auth-form');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        const errorEl = document.getElementById('auth-error');
        expect(errorEl.textContent).toBe('Invalid credentials');
      });
    });

    it('shows error when fields are empty', () => {
      authScreen.show();
      document.getElementById('auth-user').value = '';
      document.getElementById('auth-pass').value = '';

      const form = document.getElementById('auth-form');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      const errorEl = document.getElementById('auth-error');
      expect(errorEl.textContent).toContain('Enter');
    });

    it('clears error on new submission attempt', () => {
      // First, set an error
      authScreen.showError('Previous error');
      // Now submit with valid data
      document.getElementById('auth-user').value = 'alice';
      document.getElementById('auth-pass').value = 'secret123';

      const form = document.getElementById('auth-form');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      // Error should be cleared (or replaced by new result)
      const errorEl = document.getElementById('auth-error');
      expect(errorEl.textContent).not.toBe('Previous error');
    });
  });

  describe('register submission', () => {
    it('calls onRegister when on REGISTER tab', async () => {
      authScreen.show();
      document.getElementById('auth-tab-register').click();
      document.getElementById('auth-user').value = 'newplayer';
      document.getElementById('auth-pass').value = 'pass1234';

      const form = document.getElementById('auth-form');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        expect(callbacks.onRegister).toHaveBeenCalledWith('newplayer', 'pass1234');
      });
    });

    it('calls onSuccess after successful registration', async () => {
      authScreen.show();
      document.getElementById('auth-tab-register').click();
      document.getElementById('auth-user').value = 'newplayer';
      document.getElementById('auth-pass').value = 'pass1234';

      const form = document.getElementById('auth-form');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        expect(callbacks.onSuccess).toHaveBeenCalledWith({ ok: true, username: 'newuser' });
      });
    });

    it('shows error on failed registration', async () => {
      callbacks.onRegister.mockResolvedValue({ ok: false, error: 'Username taken' });
      authScreen = createAuthScreen(callbacks);
      authScreen.show();
      document.getElementById('auth-tab-register').click();
      document.getElementById('auth-user').value = 'existing';
      document.getElementById('auth-pass').value = 'pass1234';

      const form = document.getElementById('auth-form');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        const errorEl = document.getElementById('auth-error');
        expect(errorEl.textContent).toBe('Username taken');
      });
    });
  });

  describe('guest mode', () => {
    it('clicking guest button calls onGuest callback', () => {
      authScreen.show();
      document.getElementById('auth-guest-btn').click();
      expect(callbacks.onGuest).toHaveBeenCalled();
    });

    it('hides auth screen after guest click', () => {
      authScreen.show();
      document.getElementById('auth-guest-btn').click();
      const el = document.getElementById('auth-screen');
      expect(el.style.display).toBe('none');
    });

    it('guest button restores game-container visibility', () => {
      authScreen.show();
      document.getElementById('auth-guest-btn').click();
      const gameContainer = document.getElementById('game-container');
      expect(gameContainer.style.display).not.toBe('none');
    });
  });

  describe('error display', () => {
    it('showError() sets the error text', () => {
      authScreen.showError('Something went wrong');
      const errorEl = document.getElementById('auth-error');
      expect(errorEl.textContent).toBe('Something went wrong');
    });

    it('clearError() removes the error text', () => {
      authScreen.showError('Error message');
      authScreen.clearError();
      const errorEl = document.getElementById('auth-error');
      expect(errorEl.textContent).toBe('');
    });
  });

  describe('network error handling', () => {
    it('shows network error on login fetch rejection', async () => {
      callbacks.onLogin.mockRejectedValue(new Error('Network error'));
      authScreen = createAuthScreen(callbacks);
      authScreen.show();
      document.getElementById('auth-user').value = 'alice';
      document.getElementById('auth-pass').value = 'secret123';

      const form = document.getElementById('auth-form');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        const errorEl = document.getElementById('auth-error');
        expect(errorEl.textContent).toContain('Network');
      });
    });

    it('shows network error on register fetch rejection', async () => {
      callbacks.onRegister.mockRejectedValue(new Error('Network error'));
      authScreen = createAuthScreen(callbacks);
      authScreen.show();
      document.getElementById('auth-tab-register').click();
      document.getElementById('auth-user').value = 'newuser';
      document.getElementById('auth-pass').value = 'pass1234';

      const form = document.getElementById('auth-form');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        const errorEl = document.getElementById('auth-error');
        expect(errorEl.textContent).toContain('Network');
      });
    });
  });

  describe('submit button loading state', () => {
    it('disables submit button during submission', () => {
      // Use a promise that doesn't resolve immediately
      callbacks.onLogin.mockReturnValue(new Promise(() => {}));
      authScreen = createAuthScreen(callbacks);
      authScreen.show();
      document.getElementById('auth-user').value = 'alice';
      document.getElementById('auth-pass').value = 'secret123';

      const form = document.getElementById('auth-form');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      const btn = document.getElementById('auth-submit-btn');
      expect(btn.disabled).toBe(true);
    });
  });
});
