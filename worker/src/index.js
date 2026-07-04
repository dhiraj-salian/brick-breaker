/**
 * Brick-Breaker Leaderboard Worker
 *
 * Endpoints:
 *   GET  /scores?limit=10   → { scores: [{name, score, ts}, ...] }
 *   POST /scores            body { name, score, ts, sig }
 *                            sig = HMAC_SHA256(secret, `${name}${score}${ts}`)
 *
 * Storage: KV namespace SCORES
 *   key "scores" → JSON array, sorted desc, capped at 100
 *
 * Rate limit: 5 POSTs per IP per minute (in-memory Map, sufficient for free tier).
 * CORS: allow ALLOWED_ORIGIN env var (set to https://brickbreaker.pages.dev).
 */

const MAX_SCORES = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const TS_SKEW_MS = 5 * 60_000; // ±5 min

const rateLimitMap = new Map();

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
    const sigBytes = new Uint8Array(
      sigHex.match(/.{1,2}/g).map((b) => parseInt(b, 16))
    );
    return await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(message));
  } catch (e) {
    return false;
  }
}

async function handlePost(request, env, origin) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!rateLimit(ip)) {
    return jsonResponse({ error: 'rate_limited' }, 429, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
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

  // Read existing scores
  let scores = [];
  const raw = await env.SCORES.get('scores');
  if (raw) {
    try { scores = JSON.parse(raw); } catch (e) { scores = []; }
  }

  scores.push({ name, score, ts });
  scores.sort((a, b) => b.score - a.score);
  scores = scores.slice(0, MAX_SCORES);

  await env.SCORES.put('scores', JSON.stringify(scores));

  return jsonResponse({ ok: true, rank: scores.findIndex((s) => s.ts === ts && s.name === name) + 1 }, 200, origin);
}

async function handleGet(request, env, origin) {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), MAX_SCORES);

  let scores = [];
  const raw = await env.SCORES.get('scores');
  if (raw) {
    try { scores = JSON.parse(raw); } catch (e) { scores = []; }
  }

  return jsonResponse({ scores: scores.slice(0, limit) }, 200, origin);
}

export default {
  async fetch(request, env, ctx) {
    const origin = env.ALLOWED_ORIGIN || '*';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
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
