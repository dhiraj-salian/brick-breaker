import { describe, it, expect, beforeEach } from 'vitest';

const { default: worker } = await import('../../worker/src/index.js');

// ---------- Crypto helpers (shared with client) ----------

function toBase64(bytes) {
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

async function deriveHash(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return toBase64(new Uint8Array(bits));
}

async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await deriveHash(password, salt);
  return { salt: toBase64(salt), hash };
}

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

// ---------- Test env ----------

function makeKV() {
  return {
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
  };
}

const ENV = {
  HMAC_SECRET: 'test-secret-do-not-use-in-prod',
  ALLOWED_ORIGIN: '*',
  SCORES: makeKV(),
  USERS: makeKV(),
};

let ipCounter = 0;
function uniqueIP() {
  ipCounter++;
  return `10.${Math.floor(ipCounter / 65536) % 256}.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
}

function makeRequest(method, path, body = null, headers = {}) {
  const finalHeaders = {
    'Content-Type': 'application/json',
    'cf-connecting-ip': headers['cf-connecting-ip'] || uniqueIP(),
    ...headers,
  };
  // Don't let cf-connecting-ip be overridden by spread if already set
  if (headers['cf-connecting-ip']) {
    finalHeaders['cf-connecting-ip'] = headers['cf-connecting-ip'];
  }
  const init = { method, headers: finalHeaders };
  if (body) init.body = JSON.stringify(body);
  return new Request(`https://example.com${path}`, init);
}

function refreshEnv() {
  ENV.SCORES = makeKV();
  ENV.USERS = makeKV();
}

describe('auth worker — /auth/register', () => {
  beforeEach(() => refreshEnv());

  it('registers a new user successfully', async () => {
    const { salt, hash } = await hashPassword('pass123');
    const res = await worker.fetch(
      makeRequest('POST', '/auth/register', { username: 'alice', salt, hash }),
      ENV,
      {}
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(typeof data.token).toBe('string');
  });

  it('rejects duplicate username', async () => {
    const { salt, hash } = await hashPassword('pass123');
    await worker.fetch(
      makeRequest('POST', '/auth/register', { username: 'bob', salt, hash }),
      ENV,
      {}
    );
    const res = await worker.fetch(
      makeRequest('POST', '/auth/register', { username: 'bob', salt, hash }),
      ENV,
      {}
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe('username_taken');
  });

  it('rejects invalid username (too short)', async () => {
    const { salt, hash } = await hashPassword('pass123');
    const res = await worker.fetch(
      makeRequest('POST', '/auth/register', { username: 'ab', salt, hash }),
      ENV,
      {}
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_username');
  });

  it('rejects invalid username (special chars)', async () => {
    const { salt, hash } = await hashPassword('pass123');
    const res = await worker.fetch(
      makeRequest('POST', '/auth/register', { username: 'alice!', salt, hash }),
      ENV,
      {}
    );
    expect(res.status).toBe(400);
  });

  it('rejects username > 20 chars', async () => {
    const { salt, hash } = await hashPassword('pass123');
    const res = await worker.fetch(
      makeRequest('POST', '/auth/register', { username: 'a'.repeat(21), salt, hash }),
      ENV,
      {}
    );
    expect(res.status).toBe(400);
  });

  it('rejects missing salt or hash', async () => {
    const res = await worker.fetch(
      makeRequest('POST', '/auth/register', { username: 'alice', salt: '', hash: '' }),
      ENV,
      {}
    );
    expect(res.status).toBe(400);
  });
});

describe('auth worker — /auth/salt', () => {
  beforeEach(() => refreshEnv());

  it('returns salt for existing user', async () => {
    const { salt, hash } = await hashPassword('pass123');
    await worker.fetch(
      makeRequest('POST', '/auth/register', { username: 'carol', salt, hash }),
      ENV,
      {}
    );
    const res = await worker.fetch(makeRequest('GET', '/auth/salt?username=carol'), ENV, {});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.salt).toBe(salt);
  });

  it('returns 404 for non-existent user', async () => {
    const res = await worker.fetch(makeRequest('GET', '/auth/salt?username=nobody'), ENV, {});
    expect(res.status).toBe(404);
  });
});

describe('auth worker — /auth/login', () => {
  beforeEach(() => refreshEnv());

  it('logs in with correct password', async () => {
    const { salt, hash } = await hashPassword('mypassword');
    await worker.fetch(
      makeRequest('POST', '/auth/register', { username: 'dave', salt, hash }),
      ENV,
      {}
    );
    const res = await worker.fetch(
      makeRequest('POST', '/auth/login', { username: 'dave', salt, hash }),
      ENV,
      {}
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(typeof data.token).toBe('string');
  });

  it('rejects wrong password', async () => {
    const cred1 = await hashPassword('correct');
    await worker.fetch(
      makeRequest('POST', '/auth/register', { username: 'eve', ...cred1 }),
      ENV,
      {}
    );
    const cred2 = await hashPassword('wrong');
    const res = await worker.fetch(
      makeRequest('POST', '/auth/login', { username: 'eve', ...cred2 }),
      ENV,
      {}
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('invalid_credentials');
  });

  it('rejects login for non-existent user', async () => {
    const { salt, hash } = await hashPassword('pass123');
    const res = await worker.fetch(
      makeRequest('POST', '/auth/login', { username: 'ghost', salt, hash }),
      ENV,
      {}
    );
    expect(res.status).toBe(401);
  });
});

describe('auth worker — /auth/me', () => {
  beforeEach(() => refreshEnv());

  it('returns user info with valid token', async () => {
    const { salt, hash } = await hashPassword('pass123');
    const regRes = await worker.fetch(
      makeRequest('POST', '/auth/register', { username: 'frank', salt, hash }),
      ENV,
      {}
    );
    const token = (await regRes.json()).token;

    const res = await worker.fetch(
      makeRequest('GET', '/auth/me', null, { Authorization: `Bearer ${token}` }),
      ENV,
      {}
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.username).toBe('frank');
    expect(data.bestScore).toBe(0);
    expect(data.gamesPlayed).toBe(0);
  });

  it('rejects request without token', async () => {
    const res = await worker.fetch(makeRequest('GET', '/auth/me'), ENV, {});
    expect(res.status).toBe(401);
  });

  it('rejects invalid token', async () => {
    const res = await worker.fetch(
      makeRequest('GET', '/auth/me', null, { Authorization: 'Bearer invalid.token.here' }),
      ENV,
      {}
    );
    expect(res.status).toBe(401);
  });
});

describe('auth worker — /scores with bearer token', () => {
  beforeEach(() => refreshEnv());

  it('attaches username to score when authenticated', async () => {
    const { salt, hash } = await hashPassword('pass123');
    const regRes = await worker.fetch(
      makeRequest('POST', '/auth/register', { username: 'grace', salt, hash }),
      ENV,
      {}
    );
    const token = (await regRes.json()).token;

    const ts = Date.now();
    const sig = await hmacHex(`grace${500}${ts}`, ENV.HMAC_SECRET);
    const res = await worker.fetch(
      makeRequest(
        'POST',
        '/scores',
        { name: 'grace', score: 500, ts, sig },
        { Authorization: `Bearer ${token}` }
      ),
      ENV,
      {}
    );
    expect(res.status).toBe(200);

    const getRes = await worker.fetch(makeRequest('GET', '/scores'), ENV, {});
    const data = await getRes.json();
    expect(data.scores).toHaveLength(1);
    expect(data.scores[0].username).toBe('grace');

    const meRes = await worker.fetch(
      makeRequest('GET', '/auth/me', null, { Authorization: `Bearer ${token}` }),
      ENV,
      {}
    );
    const meData = await meRes.json();
    expect(meData.bestScore).toBe(500);
    expect(meData.gamesPlayed).toBe(1);
  });

  it('still works without token (backward compat)', async () => {
    const ts = Date.now();
    const sig = await hmacHex(`Swift-Falcon-0429${300}${ts}`, ENV.HMAC_SECRET);
    const res = await worker.fetch(
      makeRequest('POST', '/scores', { name: 'Swift-Falcon-0429', score: 300, ts, sig }),
      ENV,
      {}
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    const getRes = await worker.fetch(makeRequest('GET', '/scores'), ENV, {});
    const data = await getRes.json();
    expect(data.scores).toHaveLength(1);
    expect(data.scores[0].name).toBe('Swift-Falcon-0429');
    expect(data.scores[0].username).toBeUndefined();
  });
});

describe('auth worker — rate limiting', () => {
  beforeEach(() => refreshEnv());

  it('rate limits /scores after 5 POSTs from same IP', async () => {
    const dedicatedIP = '172.16.0.1';
    const ts = Date.now();
    for (let i = 0; i < 5; i++) {
      const sig = await hmacHex(`user${i}${i * 10}${ts}`, ENV.HMAC_SECRET);
      const res = await worker.fetch(
        makeRequest(
          'POST',
          '/scores',
          { name: `user${i}`, score: i * 10, ts, sig },
          { 'cf-connecting-ip': dedicatedIP }
        ),
        ENV,
        {}
      );
      expect(res.status).toBe(200);
    }
    const sig = await hmacHex(`overflow${999}${ts}`, ENV.HMAC_SECRET);
    const res = await worker.fetch(
      makeRequest(
        'POST',
        '/scores',
        { name: 'overflow', score: 999, ts, sig },
        { 'cf-connecting-ip': dedicatedIP }
      ),
      ENV,
      {}
    );
    expect(res.status).toBe(429);
  });

  it('rate limits /auth/register after 5 from same IP', async () => {
    const dedicatedIP = '172.16.0.2';
    for (let i = 0; i < 5; i++) {
      const { salt, hash } = await hashPassword('pass123');
      const res = await worker.fetch(
        makeRequest(
          'POST',
          '/auth/register',
          { username: `user${i}`, salt, hash },
          { 'cf-connecting-ip': dedicatedIP }
        ),
        ENV,
        {}
      );
      expect(res.status).toBe(200);
    }
    const { salt, hash } = await hashPassword('pass123');
    const res = await worker.fetch(
      makeRequest(
        'POST',
        '/auth/register',
        { username: 'overflow', salt, hash },
        { 'cf-connecting-ip': dedicatedIP }
      ),
      ENV,
      {}
    );
    expect(res.status).toBe(429);
  });
});

describe('auth worker — misc', () => {
  it('returns 404 for unknown auth route', async () => {
    refreshEnv();
    const res = await worker.fetch(makeRequest('GET', '/auth/unknown'), ENV, {});
    expect(res.status).toBe(404);
  });

  it('OPTIONS returns 204 with CORS headers including Authorization', async () => {
    refreshEnv();
    const res = await worker.fetch(makeRequest('OPTIONS', '/auth/register'), ENV, {});
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });
});
