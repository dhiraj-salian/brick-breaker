/**
 * AuthScreen — full-screen login/register overlay that gates game access.
 *
 * Owns: auth-screen state machine (show/hide), tab switcher (LOGIN ↔ REGISTER),
 * form submission, error display, guest link, loading state.
 *
 * Does NOT own: identity store, session management, or menu logic.
 * Those are wired via callbacks from main.js.
 *
 * @module ui/auth-screen
 */

const $ = (id) => document.getElementById(id);

/**
 * Create the auth screen controller.
 *
 * @param {Object} callbacks
 * @param {(username: string, password: string) => Promise<{ok: boolean, username?: string, error?: string}>} callbacks.onLogin
 * @param {(username: string, password: string) => Promise<{ok: boolean, username?: string, error?: string}>} callbacks.onRegister
 * @param {() => void} [callbacks.onGuest] - Called when user clicks "Continue as Guest"
 * @param {(user: {username: string}) => void} [callbacks.onSuccess] - Called after successful login or register
 * @returns {AuthScreenAPI}
 */
export function createAuthScreen(callbacks) {
  const { onLogin, onRegister, onGuest, onSuccess } = callbacks;
  let mode = 'login'; // 'login' | 'register'
  let submitting = false;

  const el = () => $('auth-screen');
  const gameContainer = () => $('game-container');

  // ---------- Tab switching ----------

  function setMode(newMode) {
    mode = newMode;
    const loginTab = $('auth-tab-login');
    const registerTab = $('auth-tab-register');
    const submitBtn = $('auth-submit-btn');

    if (newMode === 'login') {
      loginTab.classList.add('active');
      loginTab.setAttribute('aria-selected', 'true');
      registerTab.classList.remove('active');
      registerTab.setAttribute('aria-selected', 'false');
      submitBtn.textContent = 'LOGIN';
    } else {
      registerTab.classList.add('active');
      registerTab.setAttribute('aria-selected', 'true');
      loginTab.classList.remove('active');
      loginTab.setAttribute('aria-selected', 'false');
      submitBtn.textContent = 'REGISTER';
    }
    clearError();
  }

  // ---------- Show / Hide ----------

  function show() {
    const screen = el();
    if (!screen) return;
    screen.style.display = 'flex';
    screen.classList.add('active');
    // Hide game container (canvas + menu + leaderboard panel + HUD)
    const gc = gameContainer();
    if (gc) gc.style.display = 'none';
    // Focus username input for accessibility
    const userInput = $('auth-user');
    if (userInput) {
      // Defer focus to next frame for reliability
      requestAnimationFrame(() => userInput.focus());
    }
  }

  function hide() {
    const screen = el();
    if (!screen) return;
    screen.style.display = 'none';
    screen.classList.remove('active');
    // Restore game container
    const gc = gameContainer();
    if (gc) gc.style.display = '';
  }

  // ---------- Error display ----------

  function showError(msg) {
    const errorEl = $('auth-error');
    if (errorEl) errorEl.textContent = msg;
  }

  function clearError() {
    const errorEl = $('auth-error');
    if (errorEl) errorEl.textContent = '';
  }

  // ---------- Form submission ----------

  async function handleSubmit() {
    if (submitting) return;

    const username = ($('auth-user')?.value || '').trim();
    const password = $('auth-pass')?.value || '';

    if (!username || !password) {
      showError('Enter username and password');
      return;
    }

    clearError();
    submitting = true;
    const submitBtn = $('auth-submit-btn');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const result =
        mode === 'login' ? await onLogin(username, password) : await onRegister(username, password);

      if (result?.ok) {
        // Clear form fields
        const passInput = $('auth-pass');
        if (passInput) passInput.value = '';
        hide();
        if (onSuccess) onSuccess(result);
      } else {
        showError(result?.error || (mode === 'login' ? 'Login failed' : 'Registration failed'));
      }
    } catch (e) {
      showError('Network error — please try again');
    } finally {
      submitting = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  // ---------- Wire up DOM events ----------

  // Tab buttons
  const loginTab = $('auth-tab-login');
  if (loginTab) {
    loginTab.addEventListener('click', (e) => {
      e.stopPropagation();
      setMode('login');
    });
  }

  const registerTab = $('auth-tab-register');
  if (registerTab) {
    registerTab.addEventListener('click', (e) => {
      e.stopPropagation();
      setMode('register');
    });
  }

  // Form submit (Enter key or button click)
  const form = $('auth-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleSubmit();
    });
  }

  // Guest link
  const guestBtn = $('auth-guest-btn');
  if (guestBtn) {
    guestBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hide();
      if (onGuest) onGuest();
    });
  }

  return {
    show,
    hide,
    setMode,
    showError,
    clearError,
    getMode: () => mode,
    isSubmitting: () => submitting,
  };
}
