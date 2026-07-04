import { describe, it, expect, beforeEach } from 'vitest';
// @cloudflare/vitest-pool-workers provides `env` and `SELF` globals.
// We import the worker entry directly.

const { default: worker } = await import('../../worker/src/index.js');

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

const ENV = {
  HMAC_SECRET: 'test-secret-do-not-use-in-prod',
  ALLOWED_ORIGIN: '*',
  SCORES: {
    _data: new Map(),
    async get(key) {
      return this._data.get(key) || null;
    },
    async put(key, value) {
      this._data.set(key, value);
    },
    async delete(key) {
      this._data.delete(key);
    },
  },
};

function makeRequest(method, path, body = null) {
  const init = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) init.body = JSON.stringify(body);
  return new Request(`https://example.com${path}`, init);
}

describe('leaderboard worker', () => {
  beforeEach(() => {
    ENV.SCORES._data.clear();
  });

  it('GET /health returns ok', async () => {
    const res = await worker.fetch(makeRequest('GET', '/health'), ENV, {});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it('GET /scores returns empty array initially', async () => {
    const res = await worker.fetch(makeRequest('GET', '/scores'), ENV, {});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.scores).toEqual([]);
  });

  it('POST /scores with valid HMAC stores score', async () => {
    const ts = Date.now();
    const sig = await hmacHex(`alice${500}${ts}`, ENV.HMAC_SECRET);
    const res = await worker.fetch(
      makeRequest('POST', '/scores', { name: 'alice', score: 500, ts, sig }),
      ENV,
      {}
    );
    expect(res.status).toBe(200);

    const get = await worker.fetch(makeRequest('GET', '/scores'), ENV, {});
    const data = await get.json();
    expect(data.scores).toHaveLength(1);
    expect(data.scores[0]).toMatchObject({ name: 'alice', score: 500 });
  });

  it('POST /scores with invalid HMAC returns 403', async () => {
    const ts = Date.now();
    const res = await worker.fetch(
      makeRequest('POST', '/scores', { name: 'alice', score: 500, ts, sig: 'a'.repeat(64) }),
      ENV,
      {}
    );
    expect(res.status).toBe(403);
  });

  it('POST /scores with stale ts returns 400', async () => {
    const ts = Date.now() - 10 * 60_000; // 10 min ago
    const sig = await hmacHex(`alice${500}${ts}`, ENV.HMAC_SECRET);
    const res = await worker.fetch(
      makeRequest('POST', '/scores', { name: 'alice', score: 500, ts, sig }),
      ENV,
      {}
    );
    expect(res.status).toBe(400);
  });

  it('POST /scores with invalid score returns 400', async () => {
    const ts = Date.now();
    const sig = await hmacHex(`alice${-5}${ts}`, ENV.HMAC_SECRET);
    const res = await worker.fetch(
      makeRequest('POST', '/scores', { name: 'alice', score: -5, ts, sig }),
      ENV,
      {}
    );
    expect(res.status).toBe(400);
  });

  it('POST /scores with long name returns 400', async () => {
    const ts = Date.now();
    const longName = 'a'.repeat(25);
    const sig = await hmacHex(`${longName}${100}${ts}`, ENV.HMAC_SECRET);
    const res = await worker.fetch(
      makeRequest('POST', '/scores', { name: longName, score: 100, ts, sig }),
      ENV,
      {}
    );
    expect(res.status).toBe(400);
  });

  it('GET /scores?limit=5 caps results', async () => {
    const ts = Date.now();
    for (let i = 0; i < 8; i++) {
      const sig = await hmacHex(`p${i}${i * 10}${ts}`, ENV.HMAC_SECRET);
      const req = new Request(`https://example.com/scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': `10.0.0.${i}`, // unique IP per request to bypass rate limit
        },
        body: JSON.stringify({ name: `p${i}`, score: i * 10, ts, sig }),
      });
      await worker.fetch(req, ENV, {});
    }
    const res = await worker.fetch(makeRequest('GET', '/scores?limit=5'), ENV, {});
    const data = await res.json();
    expect(data.scores).toHaveLength(5);
    // Sorted desc
    expect(data.scores[0].score).toBe(70);
  });

  it('OPTIONS returns 204 with CORS headers', async () => {
    const res = await worker.fetch(makeRequest('OPTIONS', '/scores'), ENV, {});
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('unknown route returns 404', async () => {
    const res = await worker.fetch(makeRequest('GET', '/unknown'), ENV, {});
    expect(res.status).toBe(404);
  });
});
