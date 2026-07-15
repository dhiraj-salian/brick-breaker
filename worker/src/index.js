/**
 * Brick-Breaker Leaderboard + Auth Worker
 *
 * Endpoints:
 *   GET  /scores?limit=10   → { scores: [{name, score, ts, username?}, ...] }
 *   POST /scores            body { name, score, ts, sig, username? }
 *                            sig = HMAC_SHA256(secret, `${name}${score}${ts}`)
 *                            Optional Authorization: Bearer <token> attaches username
 *
 *   POST /auth/register     body { username, salt, hash } → { ok, token } | { error }
 *   POST /auth/login        body { username, salt, hash } → { ok, token } | { error }
 *   GET  /auth/salt?username=<name> → { salt } | { error }
 *   GET  /auth/me           header Authorization: Bearer <token> → { username, bestScore, gamesPlayed } | { error }
 *
 * Storage:
 *   KV SCORES  → key "scores" (JSON array, sorted desc, capped at 100)
 *   KV USERS   → key "user:<lowercase-username>" (user record JSON)
 *
 * Rate limit: 5 POSTs per IP per minute (shared across /scores, /auth/register, /auth/login).
 * CORS: ALLOWED_ORIGIN env var (comma-separated) or "*".
 *
 * Session tokens: HMAC-signed JSON {username, exp} where exp = now + 30 days.
 *   Format: base64url(payload) + "." + hex(hmac_sha256(payload_b64, HMAC_SECRET))
 *   No JWT library — uses WebCrypto subtle.sign/verify.
 */

const MAX_SCORES = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const TS_SKEW_MS = 5 * 60_000; // ±5 min
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

const rateLimitMap = new Map();

// ---------- Helpers ----------

function allowedOrigins(env) {
  const raw = env.ALLOWED_ORIGIN || '*';
  if (raw === '*') return new Set(['*']);
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

function pickOrigin(request, allowed) {
  if (allowed.has('*')) return '*';
  const reqOrigin = request.headers.get('Origin');
  if (reqOrigin && allowed.has(reqOrigin)) return reqOrigin;
  return 'null';
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(body, status = 200, origin = '*') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

function rateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  entry.count += 1;
  rateLimitMap.set(ip, entry);
  return entry.count <= RATE_LIMIT_MAX;
}

async function hmacVerify(secret, message, sigHex) {
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
    return await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(message));
  } catch {
    return false;
  }
}

// ---------- Token helpers ----------

function toBase64Url(str) {
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return str;
}

async function signToken(payload, secret) {
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

async function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
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

function extractBearerToken(request) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ---------- User record helpers ----------

function userKey(username) {
  return `user:${username.toLowerCase()}`;
}

async function getUser(env, username) {
  const raw = await env.USERS.get(userKey(username));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function putUser(env, username, record) {
  await env.USERS.put(userKey(username), JSON.stringify(record));
}

// ---------- Auth handlers ----------

async function handleRegister(request, env, origin) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!rateLimit(ip)) {
    return jsonResponse({ error: 'rate_limited' }, 429, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, origin);
  }

  const { username, salt, hash } = body;

  // Validate username
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return jsonResponse({ error: 'invalid_username' }, 400, origin);
  }
  // Validate salt + hash (base64 strings, non-empty)
  if (typeof salt !== 'string' || salt.length === 0) {
    return jsonResponse({ error: 'invalid_salt' }, 400, origin);
  }
  if (typeof hash !== 'string' || hash.length === 0) {
    return jsonResponse({ error: 'invalid_hash' }, 400, origin);
  }

  // Check for existing user
  const existing = await getUser(env, username);
  if (existing) {
    return jsonResponse({ error: 'username_taken' }, 409, origin);
  }

  const now = Date.now();
  const record = {
    username,
    passwordHash: hash,
    salt,
    createdAt: now,
    bestScore: 0,
    gamesPlayed: 0,
  };
  await putUser(env, username, record);

  const token = await signToken({ username, exp: now + TOKEN_TTL_MS }, env.HMAC_SECRET);
  return jsonResponse({ ok: true, token }, 200, origin);
}

async function handleSalt(request, env, origin) {
  const url = new URL(request.url);
  const username = url.searchParams.get('username');
  if (!username || !USERNAME_RE.test(username)) {
    return jsonResponse({ error: 'invalid_username' }, 400, origin);
  }
  const user = await getUser(env, username);
  if (!user) {
    // Don't reveal whether user exists — return a random salt.
    // For simplicity here, just return error. A production system might
    // return a deterministic fake salt to prevent enumeration.
    return jsonResponse({ error: 'user_not_found' }, 404, origin);
  }
  return jsonResponse({ salt: user.salt }, 200, origin);
}

async function handleLogin(request, env, origin) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!rateLimit(ip)) {
    return jsonResponse({ error: 'rate_limited' }, 429, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, origin);
  }

  const { username, salt, hash } = body;

  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return jsonResponse({ error: 'invalid_username' }, 400, origin);
  }
  if (typeof salt !== 'string' || typeof hash !== 'string') {
    return jsonResponse({ error: 'invalid_credentials' }, 400, origin);
  }

  const user = await getUser(env, username);
  if (!user) {
    // Log only username + error, never the password/hash/salt.
    return jsonResponse({ error: 'invalid_credentials' }, 401, origin);
  }

  // Constant-time compare the submitted hash with stored hash.
  if (!constantTimeEqual(hash, user.passwordHash)) {
    return jsonResponse({ error: 'invalid_credentials' }, 401, origin);
  }

  const now = Date.now();
  const token = await signToken({ username, exp: now + TOKEN_TTL_MS }, env.HMAC_SECRET);
  return jsonResponse({ ok: true, token }, 200, origin);
}

async function handleMe(request, env, origin) {
  const token = extractBearerToken(request);
  if (!token) {
    return jsonResponse({ error: 'no_token' }, 401, origin);
  }
  const payload = await verifyToken(token, env.HMAC_SECRET);
  if (!payload) {
    return jsonResponse({ error: 'invalid_token' }, 401, origin);
  }
  const user = await getUser(env, payload.username);
  if (!user) {
    return jsonResponse({ error: 'user_not_found' }, 404, origin);
  }
  return jsonResponse(
    { ok: true, username: user.username, bestScore: user.bestScore, gamesPlayed: user.gamesPlayed },
    200,
    origin
  );
}

// ---------- Score handlers ----------

async function handlePost(request, env, origin) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!rateLimit(ip)) {
    return jsonResponse({ error: 'rate_limited' }, 429, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, origin);
  }

  const { name, score, ts, sig } = body;
  if (typeof name !== 'string' || name.length === 0 || name.length > 20) {
    return jsonResponse({ error: 'invalid_name' }, 400, origin);
  }
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 10_000_000) {
    return jsonResponse({ error: 'invalid_score' }, 400, origin);
  }
  if (typeof ts !== 'number' || Math.abs(Date.now() - ts) > TS_SKEW_MS) {
    return jsonResponse({ error: 'invalid_ts' }, 400, origin);
  }
  if (typeof sig !== 'string' || sig.length !== 64) {
    return jsonResponse({ error: 'invalid_sig' }, 400, origin);
  }

  const secret = env.HMAC_SECRET;
  if (!secret) return jsonResponse({ error: 'server_misconfigured' }, 500, origin);

  const ok = await hmacVerify(secret, `${name}${score}${ts}`, sig);
  if (!ok) return jsonResponse({ error: 'invalid_signature' }, 403, origin);

  // Check for optional auth token — if present, attach username to score
  let authedUsername = null;
  const token = extractBearerToken(request);
  if (token) {
    const payload = await verifyToken(token, secret);
    if (payload) {
      authedUsername = payload.username;
      // Update user stats: bestScore + gamesPlayed
      const user = await getUser(env, authedUsername);
      if (user) {
        const updated = {
          ...user,
          bestScore: Math.max(user.bestScore, score),
          gamesPlayed: user.gamesPlayed + 1,
        };
        await putUser(env, authedUsername, updated);
      }
    }
  }

  // Read existing scores
  let scores = [];
  const raw = await env.SCORES.get('scores');
  if (raw) {
    try {
      scores = JSON.parse(raw);
    } catch {
      scores = [];
    }
  }

  const scoreRecord = { name, score, ts };
  if (authedUsername) scoreRecord.username = authedUsername;

  scores.push(scoreRecord);
  scores.sort((a, b) => b.score - a.score);
  scores = scores.slice(0, MAX_SCORES);

  await env.SCORES.put('scores', JSON.stringify(scores));

  return jsonResponse(
    { ok: true, rank: scores.findIndex((s) => s.ts === ts && s.name === name) + 1 },
    200,
    origin
  );
}

async function handleGet(request, env, origin) {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), MAX_SCORES);

  let scores = [];
  const raw = await env.SCORES.get('scores');
  if (raw) {
    try {
      scores = JSON.parse(raw);
    } catch {
      scores = [];
    }
  }

  return jsonResponse({ scores: scores.slice(0, limit) }, 200, origin);
}

// ---------- Router ----------

export default {
  async fetch(request, env, ctx) {
    const allowed = allowedOrigins(env);
    const origin = pickOrigin(request, allowed);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);

    // Auth endpoints
    if (url.pathname === '/auth/register' && request.method === 'POST') {
      return handleRegister(request, env, origin);
    }
    if (url.pathname === '/auth/login' && request.method === 'POST') {
      return handleLogin(request, env, origin);
    }
    if (url.pathname === '/auth/salt' && request.method === 'GET') {
      return handleSalt(request, env, origin);
    }
    if (url.pathname === '/auth/me' && request.method === 'GET') {
      return handleMe(request, env, origin);
    }

    // Score endpoints
    if (url.pathname === '/scores' && request.method === 'POST') {
      return handlePost(request, env, origin);
    }
    if (url.pathname === '/scores' && request.method === 'GET') {
      return handleGet(request, env, origin);
    }
    if (url.pathname === '/health') {
      return jsonResponse({ ok: true, ts: Date.now() }, 200, origin);
    }

    return jsonResponse({ error: 'not_found' }, 404, origin);
  },
};
