/**
 * Auth client — register, login, session management.
 *
 * Uses WebCrypto PBKDF2-SHA-256 (100k iterations, 16-byte salt) for password
 * hashing. The client generates the salt and derives the hash, so the
 * plaintext password is NEVER sent over the wire. The server stores the
 * salt + hash and verifies by recomputing.
 *
 * Session tokens are HMAC-signed JSON {username, exp} — no JWT library needed.
 * Stored in localStorage under key "bb:auth".
 */

const API_BASE = import.meta.env.VITE_LEADERBOARD_URL || '';
const STORAGE_KEY = 'bb:auth';
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_LENGTH_BITS = 256;

// ---------- Crypto helpers ----------

function toBase64(bytes) {
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

function fromBase64(str) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toBase64Url(str) {
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return str;
}

function randomBytes(n) {
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return arr;
}

/**
 * Derive a PBKDF2-SHA-256 hash from password + salt.
 * @param {string} password
 * @param {Uint8Array} salt
 * @returns {Promise<string>} base64-encoded hash
 */
export async function deriveHash(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH_BITS
  );
  return toBase64(new Uint8Array(bits));
}

/**
 * Generate a random salt and derive hash for a password.
 * @param {string} password
 * @returns {Promise<{salt: string, hash: string}>} base64-encoded salt + hash
 */
export async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const hash = await deriveHash(password, salt);
  return { salt: toBase64(salt), hash };
}

/**
 * Verify a password against a stored salt + hash.
 * @param {string} password
 * @param {string} saltBase64
 * @param {string} expectedHashBase64
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, saltBase64, expectedHashBase64) {
  const salt = fromBase64(saltBase64);
  const hash = await deriveHash(password, salt);
  return constantTimeEqual(hash, expectedHashBase64);
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ---------- Token helpers (client-side, for verifying /auth/me responses) ----------

/**
 * Sign a token: base64url(payload) + "." + hex(hmac)
 * @param {Object} payload
 * @param {string} secret
 * @returns {Promise<string>}
 */
export async function signToken(payload, secret) {
  const payloadB64 = toBase64Url(btoa(JSON.stringify(payload)));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${payloadB64}.${sigHex}`;
}

/**
 * Verify a token signature and return payload (or null if invalid/expired).
 * @param {string} token
 * @param {string} secret
 * @returns {Promise<Object|null>}
 */
export async function verifyToken(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigHex] = parts;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  try {
    const sigBytes = new Uint8Array(sigHex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));
    const ok = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(payloadB64));
    if (!ok) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(atob(fromBase64Url(payloadB64)));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- localStorage helpers ----------

export function saveSession(token, username) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, username }));
  } catch {
    /* localStorage might be unavailable (private mode) */
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.token || !data.username) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ---------- API calls ----------

/**
 * Register a new user.
 * @param {string} username  3-20 chars, alphanumeric + underscore
 * @param {string} password
 * @returns {Promise<{ok: true, token: string, username: string} | {error: string}>}
 */
export async function register(username, password) {
  const { salt, hash } = await hashPassword(password);
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, salt, hash }),
  });
  const data = await res.json();
  if (data.ok) {
    saveSession(data.token, username);
    return { ok: true, token: data.token, username };
  }
  return data;
}

/**
 * Log in an existing user.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ok: true, token: string, username: string} | {error: string}>}
 */
export async function login(username, password) {
  // Step 1: fetch the user's salt
  const saltRes = await fetch(`${API_BASE}/auth/salt?username=${encodeURIComponent(username)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!saltRes.ok) {
    const data = await saltRes.json();
    return { error: data.error || 'login_failed' };
  }
  const { salt } = await saltRes.json();
  // Step 2: derive hash with the stored salt and send for verification
  const hash = await deriveHash(password, fromBase64(salt));
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, salt, hash }),
  });
  const data = await res.json();
  if (data.ok) {
    saveSession(data.token, username);
    return { ok: true, token: data.token, username };
  }
  return data;
}

/**
 * Get current user info from token.
 * @param {string} token
 * @returns {Promise<{ok: true, username: string, bestScore: number, gamesPlayed: number} | {error: string}>}
 */
export async function getMe(token) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

/**
 * Log out — clear local session. No server call needed (stateless tokens).
 */
export function logout() {
  clearSession();
}

/**
 * Get the current auth token from localStorage, if any.
 * @returns {string|null}
 */
export function getToken() {
  const session = loadSession();
  return session?.token ?? null;
}

/**
 * Get the current username from localStorage, if any.
 * @returns {string|null}
 */
export function getUsername() {
  const session = loadSession();
  return session?.username ?? null;
}
