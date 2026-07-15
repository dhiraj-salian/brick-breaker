// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  deriveHash,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  saveSession,
  loadSession,
  clearSession,
} from '../../src/net/auth.js';

const TEST_SECRET = 'test-secret-do-not-use-in-prod';

describe('auth client — crypto helpers', () => {
  it('deriveHash returns base64 string of expected length', async () => {
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    const hash = await deriveHash('password123', salt);
    // 256 bits = 32 bytes → base64 is ~44 chars
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
    expect(hash.length).toBeLessThanOrEqual(44);
  });

  it('hashPassword returns salt + hash as base64', async () => {
    const { salt, hash } = await hashPassword('mypassword');
    expect(typeof salt).toBe('string');
    expect(typeof hash).toBe('string');
    expect(salt.length).toBeGreaterThan(0);
    expect(hash.length).toBeGreaterThan(0);
  });

  it('verifyPassword returns true for correct password', async () => {
    const { salt, hash } = await hashPassword('correctpass');
    const ok = await verifyPassword('correctpass', salt, hash);
    expect(ok).toBe(true);
  });

  it('verifyPassword returns false for wrong password', async () => {
    const { salt, hash } = await hashPassword('correctpass');
    const ok = await verifyPassword('wrongpass', salt, hash);
    expect(ok).toBe(false);
  });

  it('hashPassword produces different salts for same password', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a.salt).not.toBe(b.salt);
    // But both should verify
    expect(await verifyPassword('same', a.salt, a.hash)).toBe(true);
    expect(await verifyPassword('same', b.salt, b.hash)).toBe(true);
  });
});

describe('auth client — token sign/verify round-trip', () => {
  it('signToken + verifyToken round-trip works', async () => {
    const payload = { username: 'testuser', exp: Date.now() + 60_000 };
    const token = await signToken(payload, TEST_SECRET);
    expect(typeof token).toBe('string');
    expect(token).toContain('.');

    const verified = await verifyToken(token, TEST_SECRET);
    expect(verified).not.toBeNull();
    expect(verified.username).toBe('testuser');
  });

  it('verifyToken returns null for tampered token', async () => {
    const payload = { username: 'testuser', exp: Date.now() + 60_000 };
    const token = await signToken(payload, TEST_SECRET);
    // Tamper: flip a character in the signature
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
    const verified = await verifyToken(tampered, TEST_SECRET);
    expect(verified).toBeNull();
  });

  it('verifyToken returns null for wrong secret', async () => {
    const payload = { username: 'testuser', exp: Date.now() + 60_000 };
    const token = await signToken(payload, TEST_SECRET);
    const verified = await verifyToken(token, 'wrong-secret');
    expect(verified).toBeNull();
  });

  it('verifyToken returns null for expired token', async () => {
    const payload = { username: 'testuser', exp: Date.now() - 1000 };
    const token = await signToken(payload, TEST_SECRET);
    const verified = await verifyToken(token, TEST_SECRET);
    expect(verified).toBeNull();
  });

  it('verifyToken returns null for malformed token', async () => {
    const verified = await verifyToken('not-a-token', TEST_SECRET);
    expect(verified).toBeNull();
    const verified2 = await verifyToken('a.b.c', TEST_SECRET);
    expect(verified2).toBeNull();
  });
});

describe('auth client — localStorage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saveSession + loadSession round-trip', () => {
    saveSession('token123', 'alice');
    const session = loadSession();
    expect(session).not.toBeNull();
    expect(session.token).toBe('token123');
    expect(session.username).toBe('alice');
  });

  it('loadSession returns null when no session', () => {
    const session = loadSession();
    expect(session).toBeNull();
  });

  it('loadSession returns null for malformed data', () => {
    localStorage.setItem('bb:auth', 'not-json');
    const session = loadSession();
    expect(session).toBeNull();
  });

  it('clearSession removes stored session', () => {
    saveSession('token123', 'alice');
    clearSession();
    const session = loadSession();
    expect(session).toBeNull();
  });

  it('loadSession returns null for incomplete data', () => {
    localStorage.setItem('bb:auth', JSON.stringify({ token: 'abc' }));
    const session = loadSession();
    expect(session).toBeNull();
  });
});
