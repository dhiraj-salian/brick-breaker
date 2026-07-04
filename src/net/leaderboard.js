/**
 * Leaderboard client — submit + fetch top scores.
 * HMAC signs the payload for casual anti-cheat.
 */

const API_BASE = import.meta.env.VITE_LEADERBOARD_URL || ''; // empty = same origin (Pages Function or direct worker)

async function hmacHex(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function submitScore(name, score) {
  const ts = Date.now();
  const secret = import.meta.env.VITE_HMAC_SECRET || '';
  const sig = await hmacHex(`${name}${score}${ts}`, secret);
  const res = await fetch(`${API_BASE}/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score, ts, sig }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Score submit failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function fetchTopScores(limit = 10) {
  try {
    const res = await fetch(`${API_BASE}/scores?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.scores || [];
  } catch (e) {
    return [];
  }
}
