/**
 * Identity store — single source of truth for "who is playing".
 *
 * In-memory store with subscription support. Reads initial state from
 * localStorage (if a session token exists). The HUD, game-over screen,
 * leaderboard panel, and score submission all read from this store.
 *
 * No imports from net/ or ui/ — this module is pure logic + localStorage.
 */

const SESSION_KEY = 'bb:auth';

/**
 * Create an identity store instance.
 * @returns {Object} identity store API
 */
export function createIdentityStore() {
  let user = null;
  const subscribers = new Set();

  function notify() {
    for (const fn of subscribers) {
      try {
        fn(user);
      } catch {
        /* subscriber error — ignore */
      }
    }
  }

  return {
    /**
     * Get the current user object (or null).
     * @returns {{username: string}|null}
     */
    getUser() {
      return user;
    },

    /**
     * Get the current username (or null).
     * @returns {string|null}
     */
    getUsername() {
      return user?.username ?? null;
    },

    /**
     * Get the display name with @ prefix (or null if anonymous).
     * @returns {string|null}
     */
    getDisplayName() {
      return user ? `@${user.username}` : null;
    },

    /**
     * Whether a user is currently logged in.
     * @returns {boolean}
     */
    isLoggedIn() {
      return user !== null;
    },

    /**
     * Set the current user (or null to log out).
     * @param {{username: string}|null} newUser
     */
    setUser(newUser) {
      user = newUser;
      notify();
    },

    /**
     * Clear the current user (log out).
     */
    clear() {
      user = null;
      notify();
    },

    /**
     * Initialize from localStorage session data.
     * Reads the `bb:auth` key and populates the store if a valid session exists.
     */
    initFromSession() {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data.token || !data.username) return;
        user = { username: data.username };
        notify();
      } catch {
        /* malformed data — stay anonymous */
      }
    },

    /**
     * Subscribe to identity changes. Called immediately is NOT included
     * — only called on subsequent changes.
     * @param {(user: {username: string}|null) => void} fn
     * @returns {() => void} unsubscribe function
     */
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}
