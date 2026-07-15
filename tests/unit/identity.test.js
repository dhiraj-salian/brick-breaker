// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createIdentityStore } from '../../src/core/identity.js';

describe('identity store', () => {
  let store;

  beforeEach(() => {
    store = createIdentityStore();
    localStorage.clear();
  });

  describe('initial state', () => {
    it('starts with no user', () => {
      expect(store.getUser()).toBeNull();
    });

    it('starts not logged in', () => {
      expect(store.isLoggedIn()).toBe(false);
    });

    it('starts with no username', () => {
      expect(store.getUsername()).toBeNull();
    });
  });

  describe('setUser', () => {
    it('stores a user and marks as logged in', () => {
      store.setUser({ username: 'alice' });
      expect(store.isLoggedIn()).toBe(true);
      expect(store.getUsername()).toBe('alice');
      expect(store.getUser()).toEqual({ username: 'alice' });
    });

    it('clears user when set to null', () => {
      store.setUser({ username: 'alice' });
      store.setUser(null);
      expect(store.isLoggedIn()).toBe(false);
      expect(store.getUser()).toBeNull();
      expect(store.getUsername()).toBeNull();
    });
  });

  describe('clear', () => {
    it('clears the stored user', () => {
      store.setUser({ username: 'bob' });
      store.clear();
      expect(store.isLoggedIn()).toBe(false);
      expect(store.getUser()).toBeNull();
    });
  });

  describe('subscribe', () => {
    it('notifies subscribers on setUser', () => {
      const calls = [];
      store.subscribe((user) => calls.push(user));
      store.setUser({ username: 'alice' });
      expect(calls).toEqual([{ username: 'alice' }]);
      store.setUser(null);
      expect(calls).toEqual([{ username: 'alice' }, null]);
    });

    it('returns an unsubscribe function', () => {
      const calls = [];
      const unsub = store.subscribe((user) => calls.push(user));
      unsub();
      store.setUser({ username: 'alice' });
      expect(calls).toEqual([]);
    });

    it('supports multiple subscribers', () => {
      const callsA = [];
      const callsB = [];
      store.subscribe((u) => callsA.push(u));
      store.subscribe((u) => callsB.push(u));
      store.setUser({ username: 'alice' });
      expect(callsA).toEqual([{ username: 'alice' }]);
      expect(callsB).toEqual([{ username: 'alice' }]);
    });
  });

  describe('initFromSession', () => {
    it('loads user from localStorage session', () => {
      localStorage.setItem('bb:auth', JSON.stringify({ token: 'tok123', username: 'carol' }));
      store.initFromSession();
      expect(store.isLoggedIn()).toBe(true);
      expect(store.getUsername()).toBe('carol');
    });

    it('stays anonymous when no session exists', () => {
      store.initFromSession();
      expect(store.isLoggedIn()).toBe(false);
    });

    it('stays anonymous for malformed session data', () => {
      localStorage.setItem('bb:auth', 'not-json');
      store.initFromSession();
      expect(store.isLoggedIn()).toBe(false);
    });

    it('stays anonymous for incomplete session data', () => {
      localStorage.setItem('bb:auth', JSON.stringify({ token: 'abc' }));
      store.initFromSession();
      expect(store.isLoggedIn()).toBe(false);
    });
  });

  describe('getDisplayName', () => {
    it('returns @username when logged in', () => {
      store.setUser({ username: 'dave' });
      expect(store.getDisplayName()).toBe('@dave');
    });

    it('returns null when not logged in', () => {
      expect(store.getDisplayName()).toBeNull();
    });
  });
});
